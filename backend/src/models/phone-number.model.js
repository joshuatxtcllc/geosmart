/**
 * Phone Number Model
 * Schema for phone numbers in the system
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Routing configuration subschema
const RoutingConfigSchema = new Schema({
  // Type of routing: 'user', 'team', or 'ivr'
  type: {
    type: String,
    enum: ['user', 'team', 'ivr'],
    required: true
  },
  
  // User ID if routing to specific user
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'user';
    }
  },
  
  // Team ID if routing to team
  teamId: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: function() {
      return this.type === 'team';
    }
  },
  
  // IVR ID if routing to IVR system
  ivrId: {
    type: Schema.Types.ObjectId,
    ref: 'IVR',
    required: function() {
      return this.type === 'ivr';
    }
  },
  
  // Welcome message for IVR
  welcomeMessage: {
    type: String,
    trim: true
  },
  
  // Failover routing if primary destination unavailable
  failover: {
    enabled: {
      type: Boolean,
      default: false
    },
    
    // Failover destination type: 'voicemail', 'user', 'team'
    type: {
      type: String,
      enum: ['voicemail', 'user', 'team'],
      default: 'voicemail'
    },
    
    // User ID if failover to user
    userId: Schema.Types.ObjectId,
    
    // Team ID if failover to team
    teamId: Schema.Types.ObjectId
  },
  
  // Business hours routing
  businessHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    
    // Array of business hour definitions
    schedules: [{
      // Days of week: 0 = Sunday, 6 = Saturday
      daysOfWeek: [{ 
        type: Number,
        min: 0,
        max: 6
      }],
      
      // Start time in 24-hour format: "09:00"
      startTime: String,
      
      // End time in 24-hour format: "17:00"
      endTime: String,
      
      // Timezone for the schedule
      timezone: {
        type: String,
        default: 'UTC'
      }
    }],
    
    // After hours routing
    afterHoursRouting: {
      // Type: 'voicemail', 'user', 'team', 'message'
      type: {
        type: String,
        enum: ['voicemail', 'user', 'team', 'message'],
        default: 'voicemail'
      },
      
      // User ID if routing to user
      userId: Schema.Types.ObjectId,
      
      // Team ID if routing to team
      teamId: Schema.Types.ObjectId,
      
      // Message to play before disconnecting
      message: String
    }
  }
}, { _id: false });

// SMS configuration subschema
const SMSConfigSchema = new Schema({
  // Whether SMS is enabled for this number
  enabled: {
    type: Boolean,
    default: true
  },
  
  // Type of SMS routing: 'user', 'team', 'round-robin'
  routingType: {
    type: String,
    enum: ['user', 'team', 'round-robin'],
    default: 'user'
  },
  
  // User ID if routing to specific user
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Team ID if routing to team
  teamId: {
    type: Schema.Types.ObjectId,
    ref: 'Team'
  },
  
  // Auto-reply settings
  autoReplyEnabled: {
    type: Boolean,
    default: false
  },
  
  // Auto-reply message
  autoReplyMessage: {
    type: String,
    trim: true
  },
  
  // Auto-reply only during non-business hours
  autoReplyOnlyAfterHours: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Main Phone Number schema
const PhoneNumberSchema = new Schema({
  // The actual phone number in E.164 format
  number: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  
  // User-friendly label
  label: {
    type: String,
    trim: true
  },
  
  // Organization that owns this number
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  
  // User who this number is assigned to (if any)
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Team who this number is assigned to (if any)
  assignedToTeam: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    index: true
  },
  
  // Type of number: local, toll-free, mobile
  numberType: {
    type: String,
    enum: ['local', 'toll-free', 'mobile'],
    default: 'local'
  },
  
  // Country code for this number
  country: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 2,
    uppercase: true
  },
  
  // Whether this number can receive voice calls
  voiceEnabled: {
    type: Boolean,
    default: true
  },
  
  // Whether this number can receive/send SMS
  smsEnabled: {
    type: Boolean,
    default: true
  },
  
  // Voice call routing configuration
  routingConfig: {
    type: RoutingConfigSchema,
    default: () => ({
      type: 'user'
    })
  },
  
  // SMS configuration
  smsConfig: {
    type: SMSConfigSchema,
    default: () => ({
      enabled: true,
      routingType: 'user'
    })
  },
  
  // Voicemail settings
  voicemailEnabled: {
    type: Boolean,
    default: true
  },
  
  // Call recording settings
  callRecordingEnabled: {
    type: Boolean,
    default: false
  },
  
  // Twilio-specific information
  twilioData: {
    sid: String,
    accountSid: String,
    capabilities: {
      voice: Boolean,
      sms: Boolean,
      mms: Boolean
    }
  },
  
  // When the number was purchased
  purchasedAt: {
    type: Date,
    default: Date.now
  },
  
  // Who purchased the number
  purchasedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Whether the number is active
  active: {
    type: Boolean,
    default: true
  },
  
  // If the number has been released
  releasedAt: Date
}, {
  timestamps: true
});

// Indexes
PhoneNumberSchema.index({ orgId: 1, active: 1 });
PhoneNumberSchema.index({ assignedTo: 1, active: 1 });
PhoneNumberSchema.index({ assignedToTeam: 1, active: 1 });

// Define the model
const PhoneNumber = mongoose.model('PhoneNumber', PhoneNumberSchema);

module.exports = PhoneNumber;
