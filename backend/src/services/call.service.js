/**
 * Call Service
 * Handles all call-related business logic and Twilio integration
 */

const twilio = require('twilio');
const CallModel = require('../models/call.model');
const UserModel = require('../models/user.model');
const PhoneNumberModel = require('../models/phone-number.model');
const config = require('../config');
const logger = require('../utils/logger');

// Initialize Twilio client
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

class CallService {
  /**
   * Initiates an outbound call
   * 
   * @param {Object} callData Call information
   * @param {String} callData.from CloudCall phone number to use
   * @param {String} callData.to Recipient's phone number
   * @param {String} callData.userId User ID making the call
   * @param {Boolean} callData.record Whether to record the call
   * @param {String} callData.callbackUrl Webhook URL for call status updates
   * @returns {Object} Call information including Twilio call SID
   */
  async initiateCall(callData) {
    try {
      // Validate phone numbers
      const phoneNumber = await PhoneNumberModel.findOne({ number: callData.from });
      if (!phoneNumber) {
        throw new Error('Source phone number not found');
      }
      
      // Check permissions
      const user = await UserModel.findById(callData.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!this._canUserUsePhoneNumber(user, phoneNumber)) {
        throw new Error('User does not have permission to use this phone number');
      }
      
      // Place call via Twilio
      const call = await twilioClient.calls.create({
        url: `${config.baseUrl}/api/twilio/call-handler`,
        to: callData.to,
        from: callData.from,
        statusCallback: callData.callbackUrl || `${config.baseUrl}/api/webhooks/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: callData.record || false
      });
      
      // Log the call in our database
      const callRecord = await CallModel.create({
        twilioSid: call.sid,
        from: callData.from,
        to: callData.to,
        userId: callData.userId,
        direction: 'outbound',
        status: 'initiated',
        startTime: new Date(),
        recording: callData.record || false,
        metadata: callData.metadata || {}
      });
      
      logger.info(`Outbound call initiated: ${callRecord._id}`);
      
      return {
        id: callRecord._id,
        twilioSid: call.sid,
        status: 'initiated'
      };
    } catch (error) {
      logger.error(`Error initiating call: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Handles an incoming call
   * 
   * @param {Object} callData Twilio webhook data
   * @returns {Object} TwiML response to handle the call
   */
  async handleIncomingCall(callData) {
    try {
      const { CallSid, From, To, CallStatus } = callData;
      
      // Find which phone number was called
      const phoneNumber = await PhoneNumberModel.findOne({ number: To });
      if (!phoneNumber) {
        logger.warn(`Incoming call to unregistered number: ${To}`);
        return this._generateCallRejectionTwiML('This number is not in service.');
      }
      
      // Create call record
      const callRecord = await CallModel.create({
        twilioSid: CallSid,
        from: From,
        to: To,
        direction: 'inbound',
        status: CallStatus,
        startTime: new Date(),
        phoneNumberId: phoneNumber._id
      });
      
      // Determine how to handle the call based on phone number settings
      const routingType = phoneNumber.routingConfig.type;
      
      switch (routingType) {
        case 'user':
          return this._routeCallToUser(phoneNumber, callRecord, callData);
          
        case 'team':
          return this._routeCallToTeam(phoneNumber, callRecord, callData);
          
        case 'ivr':
          return this._routeCallToIVR(phoneNumber, callRecord, callData);
          
        default:
          logger.warn(`Unknown routing type: ${routingType}`);
          return this._generateCallRejectionTwiML('This number is not configured properly.');
      }
    } catch (error) {
      logger.error(`Error handling incoming call: ${error.message}`, { error });
      return this._generateCallRejectionTwiML('An error occurred. Please try again later.');
    }
  }
  
  /**
   * Updates a call status based on webhook data
   * 
   * @param {Object} statusData Twilio webhook status data
   * @returns {Object} Updated call record
   */
  async updateCallStatus(statusData) {
    try {
      const { CallSid, CallStatus, CallDuration } = statusData;
      
      const call = await CallModel.findOne({ twilioSid: CallSid });
      if (!call) {
        logger.warn(`Call status update for unknown call: ${CallSid}`);
        throw new Error('Call not found');
      }
      
      // Update call record
      call.status = CallStatus;
      
      if (CallStatus === 'completed') {
        call.endTime = new Date();
        call.duration = CallDuration;
      }
      
      await call.save();
      
      // If call is completed, run analytics updates
      if (CallStatus === 'completed') {
        // This would be done in a queue in a real system
        this._updateAnalytics(call);
      }
      
      return call;
    } catch (error) {
      logger.error(`Error updating call status: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Retrieves call records for a user or organization
   * 
   * @param {Object} query Query parameters
   * @param {String} query.userId User ID (optional)
   * @param {String} query.orgId Organization ID (optional)
   * @param {Date} query.startDate Start date for filtering
   * @param {Date} query.endDate End date for filtering
   * @param {Number} query.limit Max records to return
   * @param {Number} query.skip Number of records to skip
   * @returns {Array} List of call records
   */
  async getCalls(query) {
    try {
      const filter = {};
      
      if (query.userId) {
        filter.userId = query.userId;
      }
      
      if (query.orgId) {
        filter.orgId = query.orgId;
      }
      
      if (query.startDate || query.endDate) {
        filter.startTime = {};
        if (query.startDate) {
          filter.startTime.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          filter.startTime.$lte = new Date(query.endDate);
        }
      }
      
      const limit = parseInt(query.limit) || 50;
      const skip = parseInt(query.skip) || 0;
      
      const calls = await CallModel.find(filter)
        .sort({ startTime: -1 })
        .limit(limit)
        .skip(skip)
        .populate('userId', 'name email')
        .populate('phoneNumberId', 'number label');
      
      const total = await CallModel.countDocuments(filter);
      
      return {
        calls,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      };
    } catch (error) {
      logger.error(`Error retrieving calls: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get call details by ID
   * 
   * @param {String} callId Call ID
   * @returns {Object} Call details
   */
  async getCallById(callId) {
    try {
      const call = await CallModel.findById(callId)
        .populate('userId', 'name email')
        .populate('phoneNumberId', 'number label');
      
      if (!call) {
        throw new Error('Call not found');
      }
      
      // If there's a recording, get the recording URL
      if (call.recording && call.twilioSid) {
        try {
          const recordings = await twilioClient.recordings.list({ callSid: call.twilioSid });
          if (recordings.length > 0) {
            // Get the most recent recording
            const recording = recordings[0];
            call.recordingUrl = `${config.baseUrl}/api/calls/${call._id}/recording`;
            call.recordingDuration = recording.duration;
          }
        } catch (err) {
          logger.warn(`Could not retrieve recording for call ${callId}`, { error: err });
        }
      }
      
      return call;
    } catch (error) {
      logger.error(`Error retrieving call: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Ends an active call
   * 
   * @param {String} callId Call ID
   * @returns {Object} Call status
   */
  async endCall(callId) {
    try {
      const call = await CallModel.findById(callId);
      
      if (!call) {
        throw new Error('Call not found');
      }
      
      if (call.status === 'completed') {
        throw new Error('Call is already completed');
      }
      
      // End the call via Twilio
      await twilioClient.calls(call.twilioSid).update({ status: 'completed' });
      
      // Update our record
      call.status = 'completed';
      call.endTime = new Date();
      await call.save();
      
      return { status: 'completed' };
    } catch (error) {
      logger.error(`Error ending call: ${error.message}`, { error });
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
   * Generate TwiML to reject a call
   * @private
   */
  _generateCallRejectionTwiML(message) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(message);
    twiml.hangup();
    return twiml.toString();
  }
  
  /**
   * Route call to a specific user
   * @private
   */
  async _routeCallToUser(phoneNumber, callRecord, callData) {
    const userId = phoneNumber.routingConfig.userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      logger.warn(`Call routed to non-existent user: ${userId}`);
      return this._generateCallRejectionTwiML('The person you are calling is not available.');
    }
    
    // Update call record with assigned user
    callRecord.userId = userId;
    await callRecord.save();
    
    // Generate TwiML to ring the user
    const twiml = new twilio.twiml.VoiceResponse();
    
    // If user has voicemail enabled and we should try that first
    if (phoneNumber.voicemailEnabled) {
      twiml.dial({
        action: `${config.baseUrl}/api/twilio/voicemail-handler?callId=${callRecord._id}`,
        timeout: 20,
        callerId: callData.From
      }).client(user.clientName);
    } else {
      // Just ring the user's client
      twiml.dial({
        callerId: callData.From
      }).client(user.clientName);
    }
    
    return twiml.toString();
  }
  
  /**
   * Route call to a team
   * @private
   */
  async _routeCallToTeam(phoneNumber, callRecord, callData) {
    const teamId = phoneNumber.routingConfig.teamId;
    const teamMembers = await UserModel.find({ 
      teamIds: teamId,
      status: 'active'
    });
    
    if (teamMembers.length === 0) {
      logger.warn(`Call routed to empty team: ${teamId}`);
      return this._generateCallRejectionTwiML('The team you are calling is not available.');
    }
    
    // Update call record with team info
    callRecord.teamId = teamId;
    await callRecord.save();
    
    // Generate TwiML to ring all team members
    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial({
      action: `${config.baseUrl}/api/twilio/voicemail-handler?callId=${callRecord._id}`,
      timeout: 20,
      callerId: callData.From
    });
    
    // Add all team members to the dial
    teamMembers.forEach(member => {
      dial.client(member.clientName);
    });
    
    return twiml.toString();
  }
  
  /**
   * Route call to IVR system
   * @private
   */
  async _routeCallToIVR(phoneNumber, callRecord, callData) {
    const ivrId = phoneNumber.routingConfig.ivrId;
    
    // Update call record with IVR info
    callRecord.ivrId = ivrId;
    await callRecord.save();
    
    // Generate TwiML for IVR
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.gather({
      numDigits: 1,
      action: `${config.baseUrl}/api/twilio/ivr-handler?callId=${callRecord._id}&ivrId=${ivrId}`,
      method: 'POST',
      timeout: 10
    }).say(phoneNumber.routingConfig.welcomeMessage || 'Thank you for calling. Please press 1 for sales, 2 for support, or 0 to speak with an operator.');
    
    // If they don't select anything, try again
    twiml.redirect(`${config.baseUrl}/api/twilio/ivr-handler?callId=${callRecord._id}&retry=true`);
    
    return twiml.toString();
  }
  
  /**
   * Update analytics after call completion
   * @private
   */
  async _updateAnalytics(call) {
    // This would add call metrics to analytics database
    // In a real system, this would be a separate service or queue
    logger.info(`Updating analytics for call ${call._id}`);
    
    // For now, just a placeholder
    // Would track metrics like call duration, wait time, etc.
  }
}

module.exports = new CallService();
