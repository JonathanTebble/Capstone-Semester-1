// ResponseLogic.jsx
const responseLogic = [
  // Most specific triggers first
  {
    triggers: ["lost super", "check lost super", "unclaimed super", "i've lost my super", "where is my super"], // User Story 60 - More trigger variations
    response: "If you've changed jobs a few times, you might have lost super. I can help you identify unclaimed funds and guide you on consolidation to feel in control of your money."
  },
  {
    triggers: ["save money", "savings goal", "how much to save", "retire early", "estimated savings", "saving for retirement"], // User Story 1
    response: "To help you learn how much money you need to save to retire before 70, I can provide an estimated savings goal and recommended actions based on your age and income. Please provide those details."
  },
  {
    triggers: ["part-time work", "part-time affects super", "part-time retirement savings", "how part-time affects my retirement"], // User Story 2
    response: "If you're a part-time worker, I can help you understand how part-time work affects your retirement savings so you can plan your future better. Please provide your part-time hours and income."
  },
  {
    triggers: ["superannuation options", "casual employee super", "build retirement plan", "super options casual"], // User Story 4
    response: "As a casual employee, I can outline your superannuation options to help you build a retirement plan. Tell me about your employment status and income."
  },
  {
    triggers: ["age pension eligibility", "qualify for age pension", "check age pension", "am i eligible for age pension"], // User Story 32, 33
    response: "I can check your eligibility for the Age Pension and estimate your entitlements, helping you plan your retirement income sources. Please provide your age and income."
  },
  {
    triggers: ["tax on super withdrawals", "super tax after retirement", "lump sum tax", "how is super taxed"], // User Story 26, 80
    response: "For retirees, I can explain tax rates on super withdrawals, whether it's for a lump sum or a pension, so you can understand how withdrawals are taxed. Please provide your age and withdrawal type."
  },
  {
    triggers: ["salary sacrifice", "increase super", "boost super before retirement", "salary sacrificing"], // User Story 28
    response: "If you want to increase your super before retirement, I can explain salary sacrifice options and project your super growth based on your income and contribution preferences."
  },
  {
    triggers: ["no super", "set up super fund", "maximize super", "how to start super"], // User Story 23
    response: "If you have no super, I can provide guidance on how to set up a super fund and maximize it in fewer years for retirement. Please provide your income and current super status."
  },
  {
    triggers: ["redundancy payout", "redundancy affects super", "redundancy age pension", "impact of redundancy"], // User Story 75
    response: "If you've been made redundant, I can explain how your redundancy payout affects your superannuation and Age Pension access, helping you avoid unexpected tax or payment delays."
  },
  {
    triggers: ["concessional caps", "carry-forward rules", "contribution limits", "exceeding contribution limits"], // User Story 76
    response: "For high-income earners, I can help you understand concessional caps and carry-forward rules to avoid exceeding contribution limits. Please provide your concessional contributions and unused caps."
  },
  // General triggers come last
  {
    triggers: ["superannuation", "super", "what is super"], // General superannuation explanation
    response: "Superannuation is Australia's retirement savings system where employers contribute to your retirement fund."
  },
  {
    triggers: ["retirement age", "retire", "when can i retire", "when to retire"],
    response: "In Australia, the preservation age is between 55-60 depending on your birth year. Need more specifics?"
  },
  {
    triggers: ["hello", "hi", "hey"],
    response: "Hello! How can I assist you with retirement planning today?"
  }
];

export const getResponse = (message) => {
  const cleanedMessage = message.toLowerCase().trim();

  // Check if any trigger is included in the message
  const foundResponse = responseLogic.find(q =>
    q.triggers.some(trigger => cleanedMessage.includes(trigger))
  );

  return foundResponse ? foundResponse.response : "I'm sorry, I can only answer pre-defined retirement questions. Try asking about superannuation or retirement age!";
};