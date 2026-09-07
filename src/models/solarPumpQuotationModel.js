const mongoose = require('mongoose');

const solarPumpQuotationSchema = mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    quotationNo: {
      type: String,
      required: true,
      unique: true,
    },
    orderId: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    billingName: {
      type: String,
    },
    
    // --- Specific Fields for Solar Pumps ---
    
    // Required Solar Water Pumps Like 1HP, 2HP...
    pumpCapacity: { type: String, required: true }, // e.g. "5HP"
    pumpBrand: { type: String, required: true }, // e.g. "Crompton"
    pumpPrice: { type: Number, default: 0 },
    pumpWarranty: { type: String, default: '' },
    
    // Solar Panel
    panelBrand: { type: String, required: true },
    panelKW: { type: String, required: true },
    panelPrice: { type: Number, default: 0 },
    panelWarranty: { type: String, default: '' },
    
    // Cable
    cableBrand: { type: String, required: true },
    cablePrice: { type: Number, default: 0 },
    cableWarranty: { type: String, default: '' },
    
    // Structures
    structureBrand: { type: String, default: '' },
    structurePrice: { type: Number, default: 0 },
    structureWarranty: { type: String, default: '' },
    
    // Controller / Drive (optional but good to have)
    controllerBrand: { type: String, default: '' },
    controllerPrice: { type: Number, default: 0 },
    controllerWarranty: { type: String, default: '' },

    // Installation
    installationDetails: { type: String, default: 'Complete Installation & Setup' },
    installationPrice: { type: Number, default: 0 },

    // Pricing (from Image 1 & 2)
    baseAmount: { type: Number, required: true }, // Total System Cost
    earlyBirdDiscount: { type: Number, default: 0 },
    additionalDiscount: { type: Number, default: 0 },
    gstPercentage: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    isGstInclusive: { type: Boolean, default: false },
    netPrice: { type: Number, required: true }, // (Base - Discounts + GST)

    // Subsidies
    centralSubsidy: { type: Number, default: 0 }, // Central Govt DBT
    stateSubsidy: { type: Number, default: 0 }, // State Subsidy (UPNEEDA)
    netEffectivePrice: { type: Number, required: true }, // (Net Price - Subsidies)

    terms: { type: String },
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
    },
    loanDetails: {
      required: { type: Boolean, default: false },
      bankName: { type: String },
      bankAddress: { type: String },
      loanAmount: { type: Number },
      tenureMonths: { type: Number },
      interestRate: { type: Number },
      emiAmount: { type: Number },
      processingFees: { type: Number },
      downPayment: { type: Number },
      remarks: { type: String },
    },
    status: {
      type: String,
      enum: ['Pending', 'Converted', 'Cancelled'],
      default: 'Pending',
    },
    fulfillmentStatus: {
      type: String,
      enum: [
        'Quotation Created',
        'Advance received',
        'Advance confirmed',
        'Material delivery planned',
        'Material dispatched',
        'Material delivery done',
        'Installation planned',
        'Installation in progress',
        'Installation done'
      ],
      default: 'Quotation Created',
    },
    fulfillmentHistory: [
      {
        status: { type: String, required: true },
        date: { type: Date, default: Date.now },
        comment: { type: String },
        attachment: {
          url: { type: String },
          name: { type: String }
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    emiStatus: {
      type: String,
      enum: ['Not Applicable', 'EMI Applied', 'EMI Approved', 'EMI Disbursed'],
      default: 'Not Applicable',
    },
    loanApplicationId: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const SolarPumpQuotation = mongoose.model('SolarPumpQuotation', solarPumpQuotationSchema);

module.exports = SolarPumpQuotation;
