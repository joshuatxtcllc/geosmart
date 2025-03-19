/**
 * Phone Number Routes
 * Handles all routes related to phone number management
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const PhoneNumberService = require('../services/phone-number.service');
const { checkPermissions } = require('../middleware/permissions');
const router = express.Router();

/**
 * @route GET /api/phone-numbers
 * @desc Get all phone numbers for an organization
 * @access Private
 */
router.get('/', 
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('skip').optional().isInt({ min: 0 }).toInt(),
    query('search').optional().isString().trim()
  ],
  checkPermissions('phone_numbers:read'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Check if phone number exists and belongs to user's organization
      const existingNumber = await PhoneNumberService.getPhoneNumberById(req.params.id);
      if (existingNumber.orgId.toString() !== req.user.orgId.toString()) {
        return res.status(403).json({ error: 'Not authorized to release this phone number' });
      }
      
      await PhoneNumberService.releasePhoneNumber(req.params.id);
      
      res.status(200).json({ message: 'Phone number released successfully' });
    } catch (error) {
      if (error.message === 'Phone number not found') {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route POST /api/phone-numbers/:id/transfer
 * @desc Transfer a phone number to another organization (for admin use)
 * @access Private/Admin
 */
router.post('/:id/transfer',
  [
    param('id').isMongoId(),
    body('targetOrgId').isMongoId()
  ],
  checkPermissions('phone_numbers:admin'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const result = await PhoneNumberService.transferPhoneNumber(
        req.params.id,
        req.body.targetOrgId
      );
      
      res.json(result);
    } catch (error) {
      if (error.message === 'Phone number not found') {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route GET /api/phone-numbers/:id/usage
 * @desc Get usage statistics for a phone number
 * @access Private
 */
router.get('/:id/usage',
  [
    param('id').isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  checkPermissions('phone_numbers:read'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Check if phone number exists and belongs to user's organization
      const existingNumber = await PhoneNumberService.getPhoneNumberById(req.params.id);
      if (existingNumber.orgId.toString() !== req.user.orgId.toString()) {
        return res.status(403).json({ error: 'Not authorized to access this phone number' });
      }
      
      const usage = await PhoneNumberService.getPhoneNumberUsage(req.params.id, {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });
      
      res.json(usage);
    } catch (error) {
      if (error.message === 'Phone number not found') {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const result = await PhoneNumberService.getPhoneNumbers({
        orgId: req.user.orgId,
        limit: req.query.limit || 50,
        skip: req.query.skip || 0,
        search: req.query.search
      });
      
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route GET /api/phone-numbers/:id
 * @desc Get phone number details by ID
 * @access Private
 */
router.get('/:id',
  [
    param('id').isMongoId()
  ],
  checkPermissions('phone_numbers:read'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const phoneNumber = await PhoneNumberService.getPhoneNumberById(req.params.id);
      
      // Check if phone number belongs to user's organization
      if (phoneNumber.orgId.toString() !== req.user.orgId.toString()) {
        return res.status(403).json({ error: 'Not authorized to access this phone number' });
      }
      
      res.json(phoneNumber);
    } catch (error) {
      if (error.message === 'Phone number not found') {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route POST /api/phone-numbers/search
 * @desc Search available phone numbers
 * @access Private
 */
router.post('/search',
  [
    body('country').isString().isLength({ min: 2, max: 2 }),
    body('areaCode').optional().isString(),
    body('contains').optional().isString(),
    body('limit').optional().isInt({ min: 1, max: 20 }).toInt()
  ],
  checkPermissions('phone_numbers:read'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const result = await PhoneNumberService.searchAvailableNumbers({
        country: req.body.country,
        areaCode: req.body.areaCode,
        contains: req.body.contains,
        limit: req.body.limit || 10
      });
      
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route POST /api/phone-numbers/purchase
 * @desc Purchase a new phone number
 * @access Private
 */
router.post('/purchase',
  [
    body('phoneNumber').isString(),
    body('label').optional().isString().trim(),
    body('assignTo').optional().isMongoId()
  ],
  checkPermissions('phone_numbers:create'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const result = await PhoneNumberService.purchasePhoneNumber({
        phoneNumber: req.body.phoneNumber,
        label: req.body.label,
        orgId: req.user.orgId,
        userId: req.user.id,
        assignTo: req.body.assignTo
      });
      
      res.status(201).json(result);
    } catch (error) {
      console.error(error);
      if (error.message.includes('already purchased')) {
        return res.status(400).json({ error: 'Phone number is not available' });
      }
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route PUT /api/phone-numbers/:id
 * @desc Update phone number settings
 * @access Private
 */
router.put('/:id',
  [
    param('id').isMongoId(),
    body('label').optional().isString().trim(),
    body('assignedTo').optional().isMongoId(),
    body('assignedToTeam').optional().isMongoId(),
    body('routingConfig').optional().isObject(),
    body('voicemailEnabled').optional().isBoolean(),
    body('callRecordingEnabled').optional().isBoolean(),
    body('smsConfig').optional().isObject()
  ],
  checkPermissions('phone_numbers:update'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Check if phone number exists and belongs to user's organization
      const existingNumber = await PhoneNumberService.getPhoneNumberById(req.params.id);
      if (existingNumber.orgId.toString() !== req.user.orgId.toString()) {
        return res.status(403).json({ error: 'Not authorized to update this phone number' });
      }
      
      const result = await PhoneNumberService.updatePhoneNumber(req.params.id, {
        label: req.body.label,
        assignedTo: req.body.assignedTo,
        assignedToTeam: req.body.assignedToTeam,
        routingConfig: req.body.routingConfig,
        voicemailEnabled: req.body.voicemailEnabled,
        callRecordingEnabled: req.body.callRecordingEnabled,
        smsConfig: req.body.smsConfig
      });
      
      res.json(result);
    } catch (error) {
      if (error.message === 'Phone number not found') {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @route DELETE /api/phone-numbers/:id
 * @desc Release a phone number
 * @access Private
 */
router.delete('/:id',
  [
    param('id').isMongoId()
  ],
  checkPermissions('phone_numbers:delete'),
  async (req, res) => {
    try {
