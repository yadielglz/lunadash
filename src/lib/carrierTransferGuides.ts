export type CarrierTransferGuide = {
  id: string
  name: string
  aliases: string[]
  color: string
  accountNumber: string[]
  transferPin: string[]
  notes: string[]
  sourceUrl: string
}

export const CARRIER_TRANSFER_GUIDES: CarrierTransferGuide[] = [
  {
    id: 'att',
    name: 'AT&T',
    aliases: ['att', 'at&t wireless'],
    color: '#00a8e0',
    accountNumber: [
      'Find it on the wireless bill or in the signed-in AT&T account profile.',
      'Use the wireless account number exactly as shown; it is not the phone number.',
    ],
    transferPin: [
      'From an AT&T phone on the account, dial *PORT (*7678) and follow the prompts.',
      'The account owner can also request it from the Number Transfer PIN section online or in myAT&T.',
    ],
    notes: [
      'The PIN normally expires after 4 days; request another if it expires.',
      'Wireless Account Lock must be turned off before the port request.',
      'AT&T PREPAID uses the account security PIN instead of a temporary Number Transfer PIN.',
    ],
    sourceUrl: 'https://www.att.com/support/article/wireless/KM1447526/',
  },
  {
    id: 'verizon',
    name: 'Verizon',
    aliases: ['vzw', 'verizon wireless'],
    color: '#ee0000',
    accountNumber: [
      'Find it on the bill or under Account in My Verizon.',
      'Enter the account number without the dash and trailing location code shown on some bills.',
    ],
    transferPin: [
      'Dial #PORT (#7678) from a phone on the account, or create the PIN in My Verizon on the web or app.',
      'In My Verizon, search for “Number Transfer PIN” and select Generate PIN.',
    ],
    notes: [
      'Turn Number Lock off for every line being transferred.',
      'The PIN is valid for 7 days and is used with the account number, not the regular account PIN.',
      'Keep the line active until the transfer completes.',
    ],
    sourceUrl: 'https://www.verizon.com/support/port-out-faqs/',
  },
  {
    id: 'xfinity',
    name: 'Xfinity Mobile',
    aliases: ['comcast', 'xfinity'],
    color: '#6138f5',
    accountNumber: [
      'Use the Xfinity Mobile account number shown on the mobile bill or account page.',
      'Confirm the mobile account number when the customer also has Xfinity Internet service.',
    ],
    transferPin: [
      'Xfinity app: Services → Mobile Lines and Data Usage → choose the line → Transfer or cancel this line → Get started.',
      'Verify the account, choose a number to receive the text, then select Send My PIN.',
    ],
    notes: [
      'Turn Number Lock off before submitting the transfer.',
      'The security PIN is valid for 7 days and can be used for any number on the account.',
      'Do not cancel the line first; a completed port closes the transferred line.',
    ],
    sourceUrl: 'https://www.xfinity.com/support/articles/cancel-xfinity-mobile-service',
  },
  {
    id: 'spectrum',
    name: 'Spectrum Mobile',
    aliases: ['charter', 'spectrum'],
    color: '#0073d1',
    accountNumber: [
      'Find the account number on the Spectrum statement or in the signed-in Spectrum account.',
      'Use the Mobile account details presented with the transfer information.',
    ],
    transferPin: [
      'Sign in at Spectrum.net or open My Spectrum: Services → Mobile → select the line.',
      'Choose Transfer Your Number or Transfer PIN, verify the account, and generate the PIN.',
    ],
    notes: [
      'Turn Account Fraud Protection off before requesting or submitting a transfer PIN.',
      'Generate a fresh PIN close to activation and copy every digit exactly.',
      'Keep Spectrum service active until the number finishes transferring.',
    ],
    sourceUrl: 'https://www.spectrum.net/support/mobile/transfer-your-number-spectrum-mobile-another-carrier',
  },
  {
    id: 'cricket',
    name: 'Cricket Wireless',
    aliases: ['cricket'],
    color: '#5c9b31',
    accountNumber: [
      'Sign in to myCricket and open Account Settings to view the account number.',
      'It can also be provided by Cricket Support after account verification.',
    ],
    transferPin: [
      'Request the Number Transfer PIN from the myCricket app or signed-in Cricket account.',
      'If self-service is unavailable, call 1-800-CRICKET (1-800-274-2538) from the account holder’s phone.',
    ],
    notes: [
      'Use the generated Number Transfer PIN, not the four-digit account PIN.',
      'Remove any account or port protection before submitting the request.',
      'Keep the line active until the transfer completes.',
    ],
    sourceUrl: 'https://www.cricketwireless.com/support/account-management',
  },
  {
    id: 'metro',
    name: 'Metro by T-Mobile',
    aliases: ['metropcs', 'metro pcs', 'metro'],
    color: '#5b2c83',
    accountNumber: [
      'Sign in to the Metro app or My Account and open the account/profile details.',
      'The account number is also available from Metro Care after identity verification.',
    ],
    transferPin: [
      'In the Metro app or My Account, open Account/Profile and choose the option to get a Transfer PIN.',
      'Complete the one-time-code verification and save the generated PIN.',
    ],
    notes: [
      'The Transfer PIN is separate from the account security PIN.',
      'Disable Scam Shield Account Takeover Protection or port protection if enabled.',
      'The account holder may need to contact 611 if the self-service option is blocked.',
    ],
    sourceUrl: 'https://www.metrobyt-mobile.com/support/account',
  },
  {
    id: 'google-fi',
    name: 'Google Fi Wireless',
    aliases: ['fi', 'googlefi', 'google fi'],
    color: '#1a73e8',
    accountNumber: [
      'Fi provides the account number together with the transfer PIN during the leave/transfer flow.',
      'Each group member transferring out should use the details shown for that line.',
    ],
    transferPin: [
      'Sign in to Google Fi → Account → Manage plan → Leave Google Fi.',
      'Choose Transfer your number to another carrier and follow the prompts to reveal the account number and PIN.',
    ],
    notes: [
      'Group members may need to leave the group before their transfer details appear.',
      'Keep the Fi service active and choose the transfer option; avoid releasing the number.',
      'Copy the service address and ZIP exactly as Fi shows them.',
    ],
    sourceUrl: 'https://support.google.com/fi/answer/6079398',
  },
  {
    id: 'visible',
    name: 'Visible',
    aliases: ['visible by verizon'],
    color: '#6c2bd9',
    accountNumber: [
      'The account number is included with the port-out information sent by Visible.',
      'Request it while signed in to the Visible account for the line.',
    ],
    transferPin: [
      'Open the Visible app or website → Account → Your devices/line → Number transfer or Port-out PIN.',
      'Verify the request; Visible sends the account number and temporary PIN to the account email.',
    ],
    notes: [
      'Service must be active to transfer the number.',
      'Use the exact name, address, and ZIP saved in the Visible profile.',
      'Generate a new PIN if the first one expires before submission.',
    ],
    sourceUrl: 'https://www.visible.com/help/port-out-transfer-pin',
  },
  {
    id: 'mint',
    name: 'Mint Mobile',
    aliases: ['mint'],
    color: '#00a67e',
    accountNumber: [
      'Sign in to the Mint Mobile app and open Account → Account Summary → Port Out Information.',
      'The account number is revealed after identity verification.',
    ],
    transferPin: [
      'Use Account → Account Summary → Port Out Information in the Mint app.',
      'Verify the request to display the account number and transfer PIN together.',
    ],
    notes: [
      'Keep the Mint plan active until the transfer completes.',
      'If Port Out Information is missing, use Mint chat or call 800-683-7392.',
      'Copy the ZIP and account-holder name exactly as registered.',
    ],
    sourceUrl: 'https://www.mintmobile.com/help/how-do-i-transfer-my-number-out-of-mint-mobile/',
  },
  {
    id: 'tello',
    name: 'Tello',
    aliases: ['tello mobile'],
    color: '#5b57d1',
    accountNumber: [
      'Tello reveals the account number and port-out PIN together in the online dashboard.',
      'This information is available in a web browser, not in the My Tello app.',
    ],
    transferPin: [
      'On Tello.com, sign in → Number Transfer → Port Out.',
      'Accept the acknowledgment, select Retrieve Port Out Information, and complete the prompts.',
    ],
    notes: [
      'The port-out PIN has 5 digits and is valid for 7 days.',
      'The 5-digit port-out PIN is different from the permanent 4-digit Security PIN.',
      'Tello sends email and SMS when it receives the transfer request.',
    ],
    sourceUrl: 'https://tello.com/help_center/number-transfer/where-can-i-find-my-port-out-information',
  },
]

