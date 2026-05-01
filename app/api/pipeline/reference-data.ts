/**
 * Embedded reference data for QA analysis
 * These are copied from /tmp/jackpot-qa-new/qa-automation/reference/
 */

export const AGENT_MAPPING = {
  manager: {
    real_name: 'Maria Martinez',
    chat_alias: 'Katie Stewart',
  },
  team_leads: [
    { real_name: 'Ernesto Centeno', chat_alias: 'David Miller' },
    { real_name: 'Ricardo Palada', chat_alias: 'William Harris' },
    { real_name: 'Marvin Espinal', chat_alias: 'Michael Brown' },
  ],
  agents: [
    { real_name: 'Ana Erazo', chat_alias: 'Brittany Carter' },
    { real_name: 'Andrea Hernandez', chat_alias: 'Emily Davis' },
    { real_name: 'Andrea Rodriguez', chat_alias: 'Amanda Walker' },
    { real_name: 'Angie Pereira', chat_alias: 'Christina Phillips' },
    { real_name: 'Ariel Lanza', chat_alias: 'Andrew Campbell' },
    { real_name: 'Cairo Osorto', chat_alias: 'Sean Edwards' },
    { real_name: 'Daniel Ayestas', chat_alias: 'Steven Green' },
    { real_name: 'Daniel Padilla', chat_alias: 'Brandon Young' },
    { real_name: 'David Berlioz', chat_alias: 'Christopher Thomas' },
    { real_name: 'Diana Lopez', chat_alias: 'Jennifer Taylor' },
    { real_name: 'Dustin Euceda', chat_alias: 'Tyler Hall' },
    { real_name: 'Eliezer Mejia', chat_alias: 'Robert Wilson' },
    { real_name: 'Evelyn Portillo', chat_alias: 'Samantha Perez' },
    { real_name: 'Guillermo Mendoza', chat_alias: 'Jason Allen' },
    { real_name: 'Jonathan Fuentes', chat_alias: 'Kyle Evans' },
    { real_name: 'Karen Perez', chat_alias: 'Melissa Collins' },
    { real_name: 'Kenneth Aguilar', chat_alias: null },
    { real_name: 'Ludovicode Flores', chat_alias: 'Mark Roberts' },
    { real_name: 'Marcos Avila', chat_alias: 'Ryan Thompson' },
    { real_name: 'Maritza Caceres', chat_alias: 'Rachel Robinson' },
    { real_name: 'Marlon Cibrian', chat_alias: 'Justin King' },
    { real_name: 'Mirza Garcia', chat_alias: 'Ashley Anderson' },
    { real_name: 'Oscar Zelaya', chat_alias: 'Nathan Wright' },
    { real_name: 'Oskar Abaunza', chat_alias: 'Patrick Scott' },
    { real_name: 'Raul Figueroa', chat_alias: 'Eric Turner' },
    { real_name: 'Rocio Duarte', chat_alias: 'Jessica Martin' },
    { real_name: 'Sebastian Zuniga', chat_alias: 'Kevin Lewis' },
  ],
};

export const PLATFORM_FACTS = {
  redemption: {
    minimum_sc_played_through: 100,
    max_per_transaction_per_day_usd: 2500,
  },
  kyc: {
    typical_timeline: 'Minutes to ~1 hour',
  },
  daily_login_bonus: {
    free: true,
    purchase_required: false,
  },
  referral: {
    qualifying_purchase_threshold_usd: 30,
  },
  restricted_states: [
    'CA', 'CT', 'DE', 'HI', 'ID', 'IL', 'IN', 'KY', 'LA', 'MD',
    'MI', 'MT', 'NJ', 'NV', 'NY', 'TN', 'UT', 'WA', 'WV',
  ],
};

export const THRESHOLDS = {
  frt_seconds: {
    team_target: 60,
    team_lead_target: 45,
    slow_threshold: 300,
  },
  closure_rate_pct: {
    team_target: 65,
    team_lead_target: 70,
    agent_target: 60,
  },
  recalls: {
    team_target_per_period: 10,
    agent_target_per_period: 2,
  },
  slow_frt_pct: {
    team_target: 2.0,
  },
  bot_abandoned_pct: {
    team_goal: 0.0,
  },
  report_generation: {
    samples_per_agent_for_llm: 7,
    max_chars_per_ticket_for_llm: 2000,
  },
};

export const SYSTEM_PROMPT = `# SYSTEM PROMPT — JackpotDaily QA Report Analyst

You are a senior customer support QA analyst for **JackpotDaily**, a US sweepstakes/social casino platform. You produce analysis of weekly chat-ticket data. Your tone is professional, factual, fair, and constructive — direct without being harsh, supportive without being soft.

## Your Task

You will receive:
1. **Period metadata**: start date, end date, period label
2. **Aggregate stats**: total tickets, avg FRT, closure rate, recalls, slow FRT count, bot abandonments
3. **Per-agent stats**: tickets, closed, closure %, avg FRT, recalls for every agent
4. **Inquiry category counts**: tickets per category, % of total
5. **Agent ticket samples**: 5–8 sampled ticket transcripts per active agent

## Output Format

You MUST respond with ONLY a valid JSON object (no markdown, no extra text), with this exact structure:

\`\`\`json
{
  "qa_report": {
    "period_label": "string",
    "team_metrics": { /* key metrics */ },
    "critical_flags": [ /* array of flags */ ],
    "recommendations": [ /* array of recommendations */ ]
  },
  "inquiry_report": {
    "category_breakdown": [ /* categories */ ],
    "top_deep_dives": [ /* narratives */ ]
  },
  "agent_report": {
    "agents": [ /* per-agent sections */ ]
  }
}
\`\`\`

## Key Rules

1. **Every flag must cite a specific ticket ID** as evidence
2. **Every recommendation must have priority and owner**
3. **Compare to platform_facts.json** — any factual error about policy is HIGH severity
4. **Use agent real names with aliases** (e.g. "Andrea Hernandez (Emily Davis)")
5. **No invented data** — if you cannot verify, omit
6. **Positive flags are required** — always include exemplary work or records

## Critical Factual Thresholds (From platform_facts.json)

- **Redemption max**: $2,500 per transaction/day (NOT $1,000 or $5,000)
- **Redemption minimum**: 100 SC played through (NOT 1,000)
- **Debit timeline**: 1–3 business days (NOT 24-48 hours)
- **ACH timeline**: up to 10 business days (NOT 3-5 days)
- **KYC timeline**: Minutes to ~1 hour (NOT 10 days)
- **Daily login bonus**: FREE, NO purchase required (common error to flag)
- **Referral threshold**: $30 cumulative (NOT $70)
- **W-9 required for**: $600+ redemptions

## Worked Example

If you see an agent write: "Daily Login Rewards require $10 purchase"
- This contradicts platform_facts (purchase_required: false)
- Severity: HIGH
- Ticket ID: cite the specific ticket number
- Best approach: Provide exact ready-to-use script

## Return Format

Output ONLY valid JSON. No markdown, no markdown code blocks, no extra text before or after.
`;

export function getAgentRealName(chatAlias: string): string | null {
  // Try to find the agent
  for (const agent of AGENT_MAPPING.agents) {
    if (agent.chat_alias === chatAlias || agent.real_name === chatAlias) {
      return agent.real_name;
    }
  }
  return null;
}

export function getAgentDisplayName(agentId: string): string {
  const real = getAgentRealName(agentId);
  if (real) {
    const alias = AGENT_MAPPING.agents.find(a => a.real_name === real)?.chat_alias;
    return alias ? `${real} (${alias})` : real;
  }
  return agentId;
}
