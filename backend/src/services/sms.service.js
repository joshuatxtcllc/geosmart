/**
 * SMS Service
 * Handles all SMS-related business logic and Twilio integration
 */

const twilio = require('twilio');
const MessageModel = require('../models/message.model');
const UserModel = require('../models/user.model');
const PhoneNumberModel = require('../models/phone-number.model');
const ContactModel = require('../models/contact.model');
const config = require('../config');
const logger = require('../utils/logger');

// Initialize Twilio client
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

class SMSService {
  /**
   * Sends an SMS message
   * 
   * @param {Object} messageData Message information
   * @param {String} messageData.from CloudCall phone number to use
   * @param {String} messageData.to Recipient's phone number
   * @param {String} messageData.body Message content
   * @param {String} messageData.userId User ID sending the message
   * @param {Array} messageData.media Optional array of media URLs
   * @returns {Object} Message information including Twilio message SID
   */
  async sendMessage(messageData) {
    try {
      // Validate phone numbers
      const phoneNumber = await PhoneNumberModel.findOne({ number: messageData.from });
      if (!phoneNumber) {
        throw new Error('Source phone number not found');
      }
      
      // Check permissions
      const user = await UserModel.findById(messageData.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!this._canUserUsePhoneNumber(user, phoneNumber)) {
        throw new Error('User does not have permission to use this phone number');
      }
      
      // Prepare media URLs if any
      const mediaUrls = messageData.media ? messageData.media.map(url => url) : [];
      
      // Send message via Twilio
      const twilioMessage = await twilioClient.messages.create({
        body: messageData.body,
        from: messageData.from,
        to: messageData.to,
        statusCallback: `${config.baseUrl}/api/webhooks/sms-status`,
        mediaUrl: mediaUrls.length > 0 ? mediaUrls : undefined
      });
      
      // Try to identify contact
      let contactId = null;
      const contact = await ContactModel.findOne({
        phoneNumbers: { $elemMatch: { number: messageData.to } },
        orgId: user.orgId
      });
      
      if (contact) {
        contactId = contact._id;
      }
      
      // Log the message in our database
      const message = await MessageModel.create({
        twilioSid: twilioMessage.sid,
        from: messageData.from,
        to: messageData.to,
        body: messageData.body,
        userId: messageData.userId,
        direction: 'outbound',
        status: 'sent',
        timestamp: new Date(),
        mediaUrls: mediaUrls,
        phoneNumberId: phoneNumber._id,
        contactId: contactId,
        metadata: messageData.metadata || {}
      });
      
      logger.info(`Outbound SMS sent: ${message._id}`);
      
      return {
        id: message._id,
        twilioSid: twilioMessage.sid,
        status: 'sent'
      };
    } catch (error) {
      logger.error(`Error sending SMS: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Handles an incoming SMS
   * 
   * @param {Object} smsData Twilio webhook data
   * @returns {Object} Status of the processed message
   */
  async handleIncomingMessage(smsData) {
    try {
      const { MessageSid, From, To, Body, NumMedia } = smsData;
      
      // Find which phone number received the message
      const phoneNumber = await PhoneNumberModel.findOne({ number: To });
      if (!phoneNumber) {
        logger.warn(`SMS to unregistered number: ${To}`);
        return { status: 'failed', error: 'Unregistered number' };
      }
      
      // Process media if present
      const mediaUrls = [];
      const numMedia = parseInt(NumMedia) || 0;
      
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = smsData[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
        }
      }
      
      // Try to identify contact
      let contactId = null;
      const contact = await ContactModel.findOne({
        phoneNumbers: { $elemMatch: { number: From } },
        orgId: phoneNumber.orgId
      });
      
      if (contact) {
        contactId = contact._id;
      }
      
      // Create message record
      const message = await MessageModel.create({
        twilioSid: MessageSid,
        from: From,
        to: To,
        body: Body,
        direction: 'inbound',
        status: 'received',
        timestamp: new Date(),
        mediaUrls: mediaUrls,
        phoneNumberId: phoneNumber._id,
        contactId: contactId
      });
      
      // Determine routing based on phone number settings
      await this._routeIncomingMessage(phoneNumber, message);
      
      // Send auto-reply if configured
      if (phoneNumber.smsConfig && phoneNumber.smsConfig.autoReply) {
        await this._sendAutoReply(phoneNumber, From, To);
      }
      
      return { status: 'processed', messageId: message._id };
    } catch (error) {
      logger.error(`Error handling incoming SMS: ${error.message}`, { error });
      return { status: 'failed', error: error.message };
    }
  }
  
  /**
   * Updates an SMS status based on webhook data
   * 
   * @param {Object} statusData Twilio webhook status data
   * @returns {Object} Updated message record
   */
  async updateMessageStatus(statusData) {
    try {
      const { MessageSid, MessageStatus } = statusData;
      
      const message = await MessageModel.findOne({ twilioSid: MessageSid });
      if (!message) {
        logger.warn(`Message status update for unknown message: ${MessageSid}`);
        throw new Error('Message not found');
      }
      
      // Update message record
      message.status = MessageStatus;
      await message.save();
      
      return message;
    } catch (error) {
      logger.error(`Error updating message status: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Retrieves message records for a conversation
   * 
   * @param {Object} query Query parameters
   * @param {String} query.userId User ID (optional)
   * @param {String} query.phoneNumber External phone number
   * @param {String} query.ourNumber Our phone number
   * @param {Number} query.limit Max records to return
   * @param {Number} query.before Message ID to get messages before
   * @returns {Array} List of message records
   */
  async getConversation(query) {
    try {
      const filter = {
        $or: [
          { from: query.phoneNumber, to: query.ourNumber },
          { from: query.ourNumber, to: query.phoneNumber }
        ]
      };
      
      // Pagination using message ID
      if (query.before) {
        const beforeMessage = await MessageModel.findById(query.before);
        if (beforeMessage) {
          filter.timestamp = { $lt: beforeMessage.timestamp };
        }
      }
      
      const limit = parseInt(query.limit) || 50;
      
      const messages = await MessageModel.find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .populate('contactId', 'name company');
      
      return {
        messages: messages.reverse(), // Return in chronological order
        hasMore: messages.length === limit
      };
    } catch (error) {
      logger.error(`Error retrieving conversation: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get all conversations for a user or org
   * 
   * @param {Object} query Query parameters
   * @param {String} query.userId User ID (optional)
   * @param {String} query.orgId Organization ID
   * @param {Number} query.limit Max records to return
   * @returns {Array} List of conversations with latest message
   */
  async getConversations(query) {
    try {
      const filter = {};
      
      if (query.orgId) {
        // Find all org phone numbers
        const phoneNumbers = await PhoneNumberModel.find({ orgId: query.orgId });
        const orgNumbersList = phoneNumbers.map(p => p.number);
        
        filter.$or = [
          { from: { $in: orgNumbersList } },
          { to: { $in: orgNumbersList } }
        ];
      }
      
      // Group messages by conversation and get the most recent one
      const conversations = await MessageModel.aggregate([
        { $match: filter },
        { 
          $sort: { timestamp: -1 } 
        },
        {
          $group: {
            _id: {
              $cond: {
                if: { $in: ["$from", phoneNumbers.map(p => p.number)] },
                then: { externalNumber: "$to", ourNumber: "$from" },
                else: { externalNumber: "$from", ourNumber: "$to" }
              }
            },
            latestMessage: { $first: "$$ROOT" },
            messageCount: { $sum: 1 },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ["$direction", "inbound"] },
                    { $eq: ["$read", false] }
                  ]},
                  1,
                  0
                ]
              }
            }
          }
        },
        { $sort: { "latestMessage.timestamp": -1 } },
        { $limit: parseInt(query.limit) || 20 }
      ]);
      
      // Populate additional data
      for (const convo of conversations) {
        // Try to get contact information
        if (convo.latestMessage.contactId) {
          const contact = await ContactModel.findById(convo.latestMessage.contactId);
          if (contact) {
            convo.contact = {
              id: contact._id,
              name: contact.name,
              company: contact.company
            };
          }
        }
        
        // If no contact found, try to look up by phone number
        if (!convo.contact) {
          const externalNumber = convo._id.externalNumber;
          const contact = await ContactModel.findOne({
            phoneNumbers: { $elemMatch: { number: externalNumber } },
            orgId: query.orgId
          });
          
          if (contact) {
            convo.contact = {
              id: contact._id,
              name: contact.name,
              company: contact.company
            };
          } else {
            // No contact found, just use the phone number
            convo.contact = {
              name: externalNumber,
              isPhoneOnly: true
            };
          }
        }
      }
      
      return conversations;
    } catch (error) {
      logger.error(`Error retrieving conversations: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Mark conversation messages as read
   * 
   * @param {Object} data Request data
   * @param {String} data.phoneNumber External phone number
   * @param {String} data.ourNumber Our phone number
   * @param {String} data.userId User ID marking as read
   * @returns {Object} Update status
   */
  async markConversationAsRead(data) {
    try {
      const result = await MessageModel.updateMany(
        {
          from: data.phoneNumber,
          to: data.ourNumber,
          direction: 'inbound',
          read: false
        },
        {
          read: true,
          readBy: data.userId,
          readAt: new Date()
        }
      );
      
      return {
        success: true,
        updatedCount: result.nModified
      };
    } catch (error) {
      logger.error(`Error marking conversation as read: ${error.message}`, { error });
      throw error;
    }
  }
  
  // Private helper methods
  
  /**
   * Check if a user has permission to use a phone number
   * @private
   */
  _canUserUsePhoneNumber(user, phoneNumber) {
    // If the number is assigned to the user, they can use it
    if (phoneNumber.assignedTo && phoneNumber.assignedTo.toString() === user._id.toString()) {
      return true;
    }
    
    // If the number is assigned to the user's team, they can use it
    if (phoneNumber.assignedToTeam && user.teamIds.includes(phoneNumber.assignedToTeam.toString())) {
      return true;
    }
    
    // If the number is assigned to the organization and the user is part of that org
    if (phoneNumber.orgId && phoneNumber.orgId.toString() === user.orgId.toString()) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Route an incoming message based on phone number settings
   * @private
   */
  async _routeIncomingMessage(phoneNumber, message) {
    const routingType = phoneNumber.smsConfig?.routingType || 'user';
    
    switch (routingType) {
      case 'user':
        // Assign to specific user
        const userId = phoneNumber.smsConfig?.userId;
        if (userId) {
          message.assignedTo = userId;
          await message.save();
          
          // Send notification to user (would be via WebSocket in real system)
          logger.info(`Message ${message._id} assigned to user ${userId}`);
        }
        break;
        
      case 'team':
        // Assign to team queue
        const teamId = phoneNumber.smsConfig?.teamId;
        if (teamId) {
          message.teamId = teamId;
          await message.save();
          
          // Send notification to team (would be via WebSocket in real system)
          logger.info(`Message ${message._id} assigned to team ${teamId}`);
        }
        break;
        
      case 'round-robin':
        // Assign to next team member in rotation
        const teamMembers = await UserModel.find({
          teamIds: phoneNumber.smsConfig?.teamId,
          status: 'active'
        });
        
        if (teamMembers.length > 0) {
          // In a real system, this would use a more sophisticated assignment algorithm
          const randomIndex = Math.floor(Math.random() * teamMembers.length);
          const assignedUser = teamMembers[randomIndex];
          
          message.assignedTo = assignedUser._id;
          message.teamId = phoneNumber.smsConfig?.teamId;
          await message.save();
          
          logger.info(`Message ${message._id} assigned to user ${assignedUser._id} via round-robin`);
        }
        break;
        
      default:
        logger.warn(`Unknown SMS routing type: ${routingType}`);
    }
  }
  
  /**
   * Send auto-reply if configured
   * @private
   */
  async _sendAutoReply(phoneNumber, from, to) {
    if (!phoneNumber.smsConfig?.autoReplyEnabled || !phoneNumber.smsConfig?.autoReplyMessage) {
      return;
    }
    
    try {
      // Send auto-reply
      await twilioClient.messages.create({
        body: phoneNumber.smsConfig.autoReplyMessage,
        from: to, // Our number
        to: from  // Their number
      });
      
      logger.info(`Auto-reply sent to ${from} from ${to}`);
    } catch (error) {
      logger.error(`Error sending auto-reply: ${error.message}`, { error });
    }
  }
}

module.exports = new SMSService();
