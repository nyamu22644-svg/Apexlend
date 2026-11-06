import { BrandConfig, InterestCalculationMethod } from './types/lending';

export const DEFAULT_BRAND: BrandConfig = {
  institutionName: 'ApexLend Kenya',
  shortName: 'ApexLend',
  tagline: 'Licensed Digital Credit Provider | Central Bank of Kenya',
  cbkLicenseNumber: 'CBK/DCP/2023/048',
  regulatoryBody: 'Central Bank of Kenya (CBK)',
  physicalAddress: 'Riverside Green Suites, 4th Floor, Riverside Drive, Nairobi, Kenya',
  supportPhone: '+254 709 912 000',
  supportEmail: 'support@apexlend.co.ke',
  mpesaPaybill: '4082200',
  mpesaAccountPrefix: 'APX',
  ussdCode: '*483*88#',
  currency: 'KES',
  primaryColor: '#167D78', // Teal
  secondaryColor: '#101C2C', // Midnight Navy
  accentColor: '#D6A85F', // Muted Gold
  surfaceColor: '#F5F7FA', // Light Grey
  whiteColor: '#FFFFFF',
  logoStyle: 'geometric-ribbon',
};

export const BRAND_PRESETS: Record<string, BrandConfig> = {
  apexlend: DEFAULT_BRAND,
  centralend: {
    institutionName: 'CentraLend Africa',
    shortName: 'CentraLend',
    tagline: 'Empowering Kenyan Enterprises & Digital Micro-Credit',
    cbkLicenseNumber: 'CBK/DCP/2023/112',
    regulatoryBody: 'Central Bank of Kenya (CBK)',
    physicalAddress: 'Delta Corner Tower A, 7th Floor, Chiromo Road, Westlands, Nairobi',
    supportPhone: '+254 711 020 000',
    supportEmail: 'clientcare@centralend.co.ke',
    mpesaPaybill: '6125000',
    mpesaAccountPrefix: 'CTL',
    ussdCode: '*384*45#',
    currency: 'KES',
    primaryColor: '#167D78',
    secondaryColor: '#101C2C',
    accentColor: '#D6A85F',
    surfaceColor: '#F5F7FA',
    whiteColor: '#FFFFFF',
    logoStyle: 'geometric-ribbon',
  },
  baraka: {
    institutionName: 'Baraka Microcredit Ltd',
    shortName: 'BarakaCredit',
    tagline: 'Trusted SME & Community Credit Solutions',
    cbkLicenseNumber: 'CBK/DCP/2024/029',
    regulatoryBody: 'Central Bank of Kenya (CBK)',
    physicalAddress: 'Kenyatta Avenue, Standard Chartered Building 3rd Floor, Nakuru / Nairobi',
    supportPhone: '+254 700 889 900',
    supportEmail: 'loans@barakacredit.co.ke',
    mpesaPaybill: '9921000',
    mpesaAccountPrefix: 'BRK',
    ussdCode: '*711*20#',
    currency: 'KES',
    primaryColor: '#167D78',
    secondaryColor: '#101C2C',
    accentColor: '#D6A85F',
    surfaceColor: '#F5F7FA',
    whiteColor: '#FFFFFF',
    logoStyle: 'geometric-ribbon',
  },
};

/**
 * Pure domain financial calculation helper
 * Keeps presentation components independent of financial logic
 */
export function calculateLoanQuote({
  amount,
  termMonths,
  interestRatePerMonth,
  method = 'reducing_balance',
  processingFeePercent = 3.0,
  exciseDutyPercent = 20.0,
}: {
  amount: number;
  termMonths: number;
  interestRatePerMonth: number;
  method?: InterestCalculationMethod;
  processingFeePercent?: number;
  exciseDutyPercent?: number;
}) {
  const r = interestRatePerMonth / 100;
  let totalInterest = 0;
  let monthlyInstallment = 0;

  if (method === 'flat') {
    totalInterest = amount * r * termMonths;
    monthlyInstallment = (amount + totalInterest) / termMonths;
  } else if (method === 'amortized' || method === 'reducing_balance') {
    // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    if (r === 0) {
      monthlyInstallment = amount / termMonths;
      totalInterest = 0;
    } else {
      const compoundFactor = Math.pow(1 + r, termMonths);
      monthlyInstallment = (amount * (r * compoundFactor)) / (compoundFactor - 1);
      totalInterest = monthlyInstallment * termMonths - amount;
    }
  }

  const baseProcessingFee = (amount * processingFeePercent) / 100;
  const exciseDuty = (baseProcessingFee * exciseDutyPercent) / 100;
  const totalFees = baseProcessingFee + exciseDuty;
  const totalRepayable = amount + totalInterest;

  return {
    principal: Math.round(amount),
    termMonths,
    interestRatePerMonth,
    monthlyInstallment: Math.round(monthlyInstallment),
    totalInterest: Math.round(totalInterest),
    baseProcessingFee: Math.round(baseProcessingFee),
    exciseDuty: Math.round(exciseDuty),
    totalFees: Math.round(totalFees),
    totalRepayable: Math.round(totalRepayable),
    apr: Number((((totalInterest + totalFees) / amount / termMonths) * 12 * 100).toFixed(1)),
  };
}

export function formatKes(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('KES', 'KES ')
    .trim();
}
