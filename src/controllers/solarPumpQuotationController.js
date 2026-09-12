const SolarPumpQuotation = require('../models/solarPumpQuotationModel');
const Lead = require('../models/leadModel');
const Payment = require('../models/paymentModel');
const { getNextSequenceValue } = require('../utils/counter');

// @desc    Create a new solar pump quotation
// @route   POST /api/solar-pumps/quotations
// @access  Private
const createQuotation = async (req, res) => {
  try {
    const {
      leadId, pumpCapacity, pumpBrand, pumpPrice, pumpWarranty,
      panelBrand, panelKW, panelPrice, panelWarranty,
      cableBrand, cablePrice, cableWarranty,
      structureBrand, structurePrice, structureWarranty,
      controllerBrand, controllerPrice, controllerWarranty,
      installationDetails, installationPrice,
      baseAmount, earlyBirdDiscount, additionalDiscount, gstPercentage,
      centralSubsidy, stateSubsidy, terms, bankDetails, loanDetails, validUntil,
      isGstInclusive, billingName
    } = req.body;

    // Generate Quotation Number (e.g. SPQ-2026-0001)
    const year = new Date().getFullYear();
    const lastQuotation = await SolarPumpQuotation.findOne({
      quotationNo: new RegExp(`^SPQ-${year}-`)
    }).sort({ quotationNo: -1 });

    let nextNumber = 1;
    if (lastQuotation) {
      const lastNo = parseInt(lastQuotation.quotationNo.split('-')[2]);
      nextNumber = lastNo + 1;
    }
    const quotationNo = `SPQ-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Calculations
    const baseAmt = Number(baseAmount) || 0;
    const earlyDisc = Number(earlyBirdDiscount) || 0;
    const addDisc = Number(additionalDiscount) || 0;

    if (earlyDisc > 10000) {
      return res.status(400).json({ message: 'Early bird discount cannot exceed ₹10,000' });
    }
    if (addDisc > 5000) {
      return res.status(400).json({ message: 'Additional discount cannot exceed ₹5,000' });
    }
    const isInclusive = isGstInclusive === true || isGstInclusive === 'true';
    const gstPerc = isInclusive ? 8.9 : (Number(gstPercentage) || 0);
    const centralSub = Number(centralSubsidy) || 0;
    const stateSub = Number(stateSubsidy) || 0;

    const totalDiscount = earlyDisc + addDisc;
    const amountAfterDiscount = Math.max(0, baseAmt - totalDiscount);
    
    let gstAmt = 0;
    let netPriceAmt = 0;
    if (isInclusive) {
      gstAmt = (amountAfterDiscount * 8.9) / 108.9;
      netPriceAmt = amountAfterDiscount;
    } else {
      gstAmt = (amountAfterDiscount * gstPerc) / 100;
      netPriceAmt = amountAfterDiscount + gstAmt;
    }

    const netEffectivePriceAmt = Math.max(0, netPriceAmt - centralSub - stateSub);

    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;

    // Generate RKS order ID
    const orderSeq = await getNextSequenceValue('order_counter');
    const orderId = `RKS${orderSeq.toString().padStart(3, '0')}`;

    const quotation = await SolarPumpQuotation.create({
      ...req.body,
      lead: leadId,
      quotationNo,
      orderId,
      
      pumpCapacity: pumpCapacity || 'N/A',
      pumpBrand: pumpBrand || 'N/A',
      pumpPrice: Number(pumpPrice) || 0,
      pumpWarranty: pumpWarranty || '',
      
      panelBrand: panelBrand || 'N/A',
      panelKW: panelKW || 'N/A',
      panelPrice: Number(panelPrice) || 0,
      panelWarranty: panelWarranty || '',
      
      cableBrand: cableBrand || 'N/A',
      cablePrice: Number(cablePrice) || 0,
      cableWarranty: cableWarranty || '',
      
      structureBrand: structureBrand || '',
      structurePrice: Number(structurePrice) || 0,
      structureWarranty: structureWarranty || '',
      
      controllerBrand: controllerBrand || '',
      controllerPrice: Number(controllerPrice) || 0,
      controllerWarranty: controllerWarranty || '',
      
      installationDetails: installationDetails || 'Complete Installation & Setup',
      installationPrice: Number(installationPrice) || 0,

      baseAmount: baseAmt,
      earlyBirdDiscount: earlyDisc,
      additionalDiscount: addDisc,
      gstPercentage: gstPerc,
      gstAmount: gstAmt,
      isGstInclusive: isInclusive,
      billingName: billingName || '',
      netPrice: netPriceAmt,
      centralSubsidy: centralSub,
      stateSubsidy: stateSub,
      netEffectivePrice: netEffectivePriceAmt,
      terms: terms || '',
      bankDetails: bankDetails || {},
      loanDetails: loanDetails || {},
      validUntil: validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.user._id,
      owner: ownerId,
    });

    // Update Lead amount
    await Lead.findByIdAndUpdate(leadId, {
      quotationAmount: netPriceAmt
    });

    res.status(201).json(quotation);
  } catch (error) {
    console.error('Solar Pump Quotation Creation Error:', error);
    res.status(400).json({ message: error.message || 'Failed to create quotation' });
  }
};

// @desc    Get all solar pump quotations
// @route   GET /api/solar-pumps/quotations
// @access  Private
const getQuotations = async (req, res) => {
  try {
    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;
    let query = { owner: ownerId };
    
    if (req.user.role !== 'admin') {
      const leads = await Lead.find({ assignedTo: req.user._id }).select('_id');
      const leadIds = leads.map(l => l._id);
      query.$or = [
        { lead: { $in: leadIds } },
        { createdBy: req.user._id }
      ];
    }

    if (req.query.isOrder === 'true') {
      const payments = await Payment.find().select('leadId');
      const paidLeadIds = payments.map(p => p.leadId.toString());
      
      if (query.$or) {
        query.lead = { $in: paidLeadIds };
      } else {
        query.lead = { $in: paidLeadIds };
      }
    }

    let quotations = await SolarPumpQuotation.find(query)
      .populate('lead', 'name email phone address paymentMode leadId')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.isOrder === 'true') {
      const allPayments = await Payment.find({ leadId: { $in: quotations.map(q => q.lead?._id) } });
      quotations = quotations.map(q => {
        const qPayments = allPayments.filter(p => p.leadId.toString() === q.lead?._id?.toString());
        const amountPaid = qPayments.reduce((acc, p) => acc + p.amount, 0);
        const netValue = q.netEffectivePrice || 0;
        return {
          ...q,
          amountPaid,
          balanceDue: Math.max(0, netValue - amountPaid)
        };
      });
    }

    res.json(quotations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get single solar pump quotation
// @route   GET /api/solar-pumps/quotations/:id
// @access  Private
const getQuotationById = async (req, res) => {
  try {
    const quotation = await SolarPumpQuotation.findById(req.params.id)
      .populate('lead', 'name email phone address paymentMode leadId')
      .populate('createdBy', 'name')
      .populate('owner', 'companyDetails');

    if (quotation) {
      res.json(quotation);
    } else {
      res.status(404).json({ message: 'Quotation not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update solar pump quotation details
// @route   PUT /api/solar-pumps/quotations/:id
// @access  Private
const updateQuotation = async (req, res) => {
  try {
    const quotation = await SolarPumpQuotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (quotation.status === 'Converted') {
      return res.status(400).json({ message: 'Converted quotation cannot be edited' });
    }

    const {
      pumpCapacity, pumpBrand, pumpPrice, pumpWarranty,
      panelBrand, panelKW, panelPrice, panelWarranty,
      cableBrand, cablePrice, cableWarranty,
      structureBrand, structurePrice, structureWarranty,
      controllerBrand, controllerPrice, controllerWarranty,
      installationDetails, installationPrice,
      baseAmount, earlyBirdDiscount, additionalDiscount, gstPercentage,
      centralSubsidy, stateSubsidy, terms, bankDetails, loanDetails, validUntil,
      isGstInclusive, billingName
    } = req.body;

    // Calculations
    const baseAmt = Number(baseAmount) || 0;
    const earlyDisc = Number(earlyBirdDiscount) || 0;
    const addDisc = Number(additionalDiscount) || 0;

    if (earlyDisc > 10000) {
      return res.status(400).json({ message: 'Early bird discount cannot exceed ₹10,000' });
    }
    if (addDisc > 5000) {
      return res.status(400).json({ message: 'Additional discount cannot exceed ₹5,000' });
    }
    const isInclusive = isGstInclusive === true || isGstInclusive === 'true';
    const gstPerc = isInclusive ? 8.9 : (Number(gstPercentage) || 0);
    const centralSub = Number(centralSubsidy) || 0;
    const stateSub = Number(stateSubsidy) || 0;

    const totalDiscount = earlyDisc + addDisc;
    const amountAfterDiscount = Math.max(0, baseAmt - totalDiscount);
    
    let gstAmt = 0;
    let netPriceAmt = 0;
    if (isInclusive) {
      gstAmt = (amountAfterDiscount * 8.9) / 108.9;
      netPriceAmt = amountAfterDiscount;
    } else {
      gstAmt = (amountAfterDiscount * gstPerc) / 100;
      netPriceAmt = amountAfterDiscount + gstAmt;
    }

    const netEffectivePriceAmt = Math.max(0, netPriceAmt - centralSub - stateSub);

    // Update specifics
    if (pumpCapacity !== undefined) quotation.pumpCapacity = pumpCapacity;
    if (pumpBrand !== undefined) quotation.pumpBrand = pumpBrand;
    if (pumpPrice !== undefined) quotation.pumpPrice = Number(pumpPrice);
    if (pumpWarranty !== undefined) quotation.pumpWarranty = pumpWarranty;

    if (panelBrand !== undefined) quotation.panelBrand = panelBrand;
    if (panelKW !== undefined) quotation.panelKW = panelKW;
    if (panelPrice !== undefined) quotation.panelPrice = Number(panelPrice);
    if (panelWarranty !== undefined) quotation.panelWarranty = panelWarranty;

    if (cableBrand !== undefined) quotation.cableBrand = cableBrand;
    if (cablePrice !== undefined) quotation.cablePrice = Number(cablePrice);
    if (cableWarranty !== undefined) quotation.cableWarranty = cableWarranty;

    if (structureBrand !== undefined) quotation.structureBrand = structureBrand;
    if (structurePrice !== undefined) quotation.structurePrice = Number(structurePrice);
    if (structureWarranty !== undefined) quotation.structureWarranty = structureWarranty;

    if (controllerBrand !== undefined) quotation.controllerBrand = controllerBrand;
    if (controllerPrice !== undefined) quotation.controllerPrice = Number(controllerPrice);
    if (controllerWarranty !== undefined) quotation.controllerWarranty = controllerWarranty;

    if (installationDetails !== undefined) quotation.installationDetails = installationDetails;
    if (installationPrice !== undefined) quotation.installationPrice = Number(installationPrice);

    quotation.baseAmount = baseAmt;
    quotation.earlyBirdDiscount = earlyDisc;
    quotation.additionalDiscount = addDisc;
    quotation.gstPercentage = gstPerc;
    quotation.gstAmount = gstAmt;
    quotation.isGstInclusive = isInclusive;
    if (billingName !== undefined) quotation.billingName = billingName;
    quotation.netPrice = netPriceAmt;
    quotation.centralSubsidy = centralSub;
    quotation.stateSubsidy = stateSub;
    quotation.netEffectivePrice = netEffectivePriceAmt;
    
    if (terms !== undefined) quotation.terms = terms;
    if (bankDetails) quotation.bankDetails = bankDetails;
    if (loanDetails) quotation.loanDetails = loanDetails;
    if (validUntil) quotation.validUntil = validUntil;

    const updatedQuotation = await quotation.save();

    await Lead.findByIdAndUpdate(quotation.lead, {
      quotationAmount: netPriceAmt
    });

    res.json(updatedQuotation);
  } catch (error) {
    console.error('Solar Pump Quotation Update Error:', error);
    res.status(400).json({ message: error.message || 'Failed to update quotation' });
  }
};

// @desc    Update fulfillment status
// @route   PATCH /api/solar-pumps/quotations/:id/fulfillment
// @access  Private
const updateFulfillmentStatus = async (req, res) => {
  try {
    const quotation = await SolarPumpQuotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    const { status, comment, attachment } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Fulfillment status is required' });
    }

    quotation.fulfillmentHistory.push({
      status,
      comment: comment || '',
      attachment: attachment || null,
      updatedBy: req.user._id,
      date: new Date()
    });
    quotation.fulfillmentStatus = status;

    const updatedQuotation = await quotation.save();
    res.json(updatedQuotation);
  } catch (error) {
    console.error('Fulfillment Update Error:', error);
    res.status(400).json({ message: error.message || 'Failed to update fulfillment status' });
  }
};

// @desc    Update EMI status
// @route   PATCH /api/solar-pumps/quotations/:id/emi-status
// @access  Private
const updateEmiStatus = async (req, res) => {
  try {
    const quotation = await SolarPumpQuotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    const { emiStatus, loanApplicationId } = req.body;
    if (!emiStatus) {
      return res.status(400).json({ message: 'EMI status is required' });
    }

    quotation.emiStatus = emiStatus;
    if (loanApplicationId !== undefined) {
      quotation.loanApplicationId = loanApplicationId;
    }

    const updatedQuotation = await quotation.save();
    res.json(updatedQuotation);
  } catch (error) {
    console.error('EMI Status Update Error:', error);
    res.status(400).json({ message: error.message || 'Failed to update EMI status' });
  }
};

// @desc    Delete a solar pump quotation
// @route   DELETE /api/solar-pumps/quotations/:id
// @access  Private (Admin only recommended)
const deleteQuotation = async (req, res) => {
  try {
    const quotation = await SolarPumpQuotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Check for linked invoices before deleting if necessary
    // Assuming we just delete it directly for now as requested
    await quotation.deleteOne();
    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createQuotation, getQuotations, getQuotationById, updateQuotation, updateFulfillmentStatus, updateEmiStatus, deleteQuotation };
