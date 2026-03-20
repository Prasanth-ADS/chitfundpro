import Groq from 'groq-sdk';
import type { ChatCompletionTool, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../db';
import {
  executeGetBusinessData,
  executeCreateScheme,
  executeDeleteScheme,
  executeCreatePool,
  executeDeletePool,
  executeScheduleReminder,
  executeCancelReminder,
  executeGetScheduledReminders,
} from './toolExecutor';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';

/** Destructive tools that require user confirmation before execution */
const DESTRUCTIVE_TOOLS = new Set(['delete_scheme', 'delete_pool']);

// ─── Groq Tool Definitions ────────────────────────────────────────────────────

const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_business_data',
      description: 'Fetch any data from the chit fund system (members, pools, schemes, payments, pot assignments, etc.)',
      parameters: {
        type: 'object',
        properties: {
          dataType: {
            type: 'string',
            enum: ['members', 'pools', 'schemes', 'payments', 'unpaid_members', 'defaulters', 'pot_assignments', 'pool_summary'],
            description: 'The type of data to fetch',
          },
          filters: {
            type: 'object',
            description: 'Optional filters like poolId, memberId, month, status',
          },
        },
        required: ['dataType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_scheme',
      description: 'Create a new chit fund scheme with payment and payout schedules',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the scheme' },
          poolAmount: { type: 'number', description: 'Total pool amount in rupees' },
          numberOfMembers: { type: 'number', description: 'Number of members (default 20)', default: 20 },
          numberOfMonths: { type: 'number', description: 'Duration in months (default 20)', default: 20 },
          paymentSchedule: { type: 'array', items: { type: 'object' }, description: 'Array of { month, amountDue } (auto-generated if omitted)' },
          payoutSchedule: { type: 'array', items: { type: 'object' }, description: 'Array of { month, potAmount } (auto-generated if omitted)' },
        },
        required: ['name', 'poolAmount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_scheme',
      description: 'Delete a scheme by name or ID. Blocked if the scheme has active or upcoming pools.',
      parameters: {
        type: 'object',
        properties: {
          schemeId: { type: 'string', description: 'Scheme ID (optional)' },
          schemeName: { type: 'string', description: 'Scheme name (optional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_pool',
      description: 'Create a new pool under an existing scheme',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the pool' },
          schemeName: { type: 'string', description: 'Name of the scheme to create this pool under' },
          startDate: { type: 'string', description: 'Start date in ISO format (YYYY-MM-DD)' },
        },
        required: ['name', 'schemeName', 'startDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_pool',
      description: 'Delete a pool by name or ID. Blocked if the pool has payment records.',
      parameters: {
        type: 'object',
        properties: {
          poolId: { type: 'string', description: 'Pool ID (optional)' },
          poolName: { type: 'string', description: 'Pool name (optional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_whatsapp_reminder',
      description: 'Schedule a recurring WhatsApp payment reminder for a pool, all pools, or a specific member on a given day each month',
      parameters: {
        type: 'object',
        properties: {
          targetType: {
            type: 'string',
            enum: ['pool', 'all_pools', 'member'],
            description: 'Who to send the reminder to',
          },
          targetId: { type: 'string', description: 'Pool or member ID (optional, resolved from name)' },
          targetName: { type: 'string', description: 'Pool or member name to resolve to ID' },
          dayOfMonth: { type: 'number', description: 'Day of month to send reminder (1-28)' },
          messageOverride: { type: 'string', description: 'Custom message text (optional, AI-generated if omitted)' },
        },
        required: ['targetType', 'dayOfMonth'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_scheduled_reminder',
      description: 'Cancel a previously scheduled WhatsApp reminder',
      parameters: {
        type: 'object',
        properties: {
          reminderId: { type: 'string', description: 'Reminder ID (optional)' },
          targetName: { type: 'string', description: 'Target name to find the reminder (optional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_scheduled_reminders',
      description: 'List all active scheduled WhatsApp reminders',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ─── Tool Executor Dispatcher ─────────────────────────────────────────────────

async function dispatchTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'get_business_data':         return executeGetBusinessData(args);
    case 'create_scheme':             return executeCreateScheme(args);
    case 'delete_scheme':             return executeDeleteScheme(args);
    case 'create_pool':               return executeCreatePool(args);
    case 'delete_pool':               return executeDeletePool(args);
    case 'schedule_whatsapp_reminder':return executeScheduleReminder(args);
    case 'cancel_scheduled_reminder': return executeCancelReminder(args);
    case 'get_scheduled_reminders':   return executeGetScheduledReminders();
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main: generateAIResponse (unchanged signature, non-tool usage) ────────────

export const generateAIResponse = async (systemPrompt: string, userMessage: string, isJson = false) => {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      model: MODEL,
      temperature: 0.3,
      response_format: isJson ? { type: 'json_object' } : { type: 'text' },
    });
    return response.choices[0]?.message?.content || null;
  } catch (error: any) {
    console.error('[AI Service Error]', error.message);
    return null;
  }
};

// ─── Main: askAssistant with Tool Use ─────────────────────────────────────────

export interface AskAssistantResult {
  type: 'reply' | 'tool_executed' | 'confirmation_required';
  /** The final text to display in the chat */
  reply: string;
  /** For tool_executed: the tool name that ran */
  toolName?: string;
  /** For tool_executed: status line to show in chat (e.g. "⚙️ Creating pool...") */
  statusLine?: string;
  /** For confirmation_required: serialised pending tool call for the frontend to send back */
  pendingToolCall?: { name: string; args: any };
  /** For confirmation_required: human friendly prompt to show the user */
  confirmationPrompt?: string;
}

export const askAssistant = async (
  userQuery: string,
  conversationHistory: ChatCompletionMessageParam[] = [],
  pendingToolCall?: { name: string; args: any },
  confirmed?: boolean
): Promise<AskAssistantResult> => {
  try {
    // ── Handle confirmed/cancelled destructive action ──────────────────────────
    if (pendingToolCall) {
      if (confirmed === false) {
        return { type: 'reply', reply: '❌ Action cancelled. Nothing was deleted.' };
      }
      if (confirmed === true) {
        const result = await dispatchTool(pendingToolCall.name, pendingToolCall.args);
        const toolLabel = pendingToolCall.name.replace(/_/g, ' ');
        const statusLine = `⚙️ Executing ${toolLabel}...`;

        // Ask Groq for a natural language confirmation
        const confirmMessages: ChatCompletionMessageParam[] = [
          { role: 'user', content: userQuery },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'confirmed_call',
                type: 'function',
                function: { name: pendingToolCall.name, arguments: JSON.stringify(pendingToolCall.args) },
              },
            ],
          } as any,
          {
            role: 'tool',
            tool_call_id: 'confirmed_call',
            content: JSON.stringify(result),
          } as any,
        ];

        const confirmResponse = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful chit fund management assistant. Summarise the action result in one short sentence. Use ✅ for success, ❌ for failure.' },
            ...confirmMessages,
          ],
          model: MODEL,
          temperature: 0.3,
        });

        const reply = confirmResponse.choices[0]?.message?.content
          || (result.success ? `✅ Done.` : `❌ ${result.reason}`);

        return { type: 'tool_executed', reply, toolName: pendingToolCall.name, statusLine };
      }
    }

    // ── Build context ──────────────────────────────────────────────────────────
    const [schemes, pools, members] = await Promise.all([
      prisma.scheme.findMany({ orderBy: { name: 'asc' } }),
      prisma.pool.findMany({ include: { scheme: true }, orderBy: { createdAt: 'desc' } }),
      prisma.member.findMany({
        where: { status: 'ACTIVE' },
        include: { enrollments: { include: { payments: { where: { status: { not: 'PAID' } } } } } },
      }),
    ]);

    const systemPrompt = `You are an intelligent assistant for a chit fund management system in India.
You have access to business tools to read data, create/delete schemes and pools, and schedule WhatsApp reminders.

Current business snapshot:
- Schemes: ${schemes.map(s => `"${s.name}" (₹${s.poolAmount})`).join(', ') || 'None'}
- Pools: ${pools.slice(0, 10).map(p => `"${p.name}" [${p.status}, Month ${p.currentMonth}]`).join(', ') || 'None'}
- Active Members: ${members.length}

Rules:
1. Format currency as ₹. Keep replies concise and friendly.
2. If asked in Tamil, respond in Tamil.
3. Use the tools to perform actions or fetch detailed data — do not make up data.
4. For deletions, always call the appropriate delete tool — the backend will handle confirmation.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userQuery },
    ];

    // ── First Groq call ────────────────────────────────────────────────────────
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // ── Plain text reply (no tool call) ───────────────────────────────────────
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        type: 'reply',
        reply: assistantMessage.content || "Sorry, I couldn't process that.",
      };
    }

    // ── Tool call ──────────────────────────────────────────────────────────────
    const toolCall = assistantMessage.tool_calls[0];
    const toolName = toolCall.function.name;
    let toolArgs: any = {};
    try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

    const toolLabel = toolName.replace(/_/g, ' ');

    // ── Destructive: require confirmation before executing ─────────────────────
    if (DESTRUCTIVE_TOOLS.has(toolName)) {
      const target = toolArgs.poolName || toolArgs.schemeName || toolArgs.poolId || toolArgs.schemeId || 'this item';
      return {
        type: 'confirmation_required',
        reply: `⚠️ Are you sure you want to **${toolLabel}** "${target}"? Reply **YES** to confirm or **NO** to cancel.`,
        pendingToolCall: { name: toolName, args: toolArgs },
        confirmationPrompt: `Delete ${target}?`,
      };
    }

    // ── Non-destructive: execute immediately ──────────────────────────────────
    const statusLine = `⚙️ ${toolLabel.charAt(0).toUpperCase() + toolLabel.slice(1)}...`;
    const toolResult = await dispatchTool(toolName, toolArgs);

    // ── Second Groq call with tool result ─────────────────────────────────────
    const followUpMessages: ChatCompletionMessageParam[] = [
      ...messages,
      { role: 'assistant', content: null, tool_calls: assistantMessage.tool_calls } as any,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      } as any,
    ];

    const followUpResponse = await groq.chat.completions.create({
      model: MODEL,
      messages: followUpMessages,
      temperature: 0.3,
    });

    const finalReply = followUpResponse.choices[0]?.message?.content
      || (toolResult.success !== false ? '✅ Done.' : `❌ ${toolResult.reason || 'Something went wrong.'}`);

    return {
      type: 'tool_executed',
      reply: finalReply,
      toolName,
      statusLine,
    };

  } catch (error: any) {
    console.error('Error in askAssistant:', error);
    return { type: 'reply', reply: "Sorry, I couldn't process that. Please try again." };
  }
};

export const predictDefaultRisk = async (memberId: string) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        enrollments: {
          include: {
            payments: true
          }
        }
      }
    });

    if (!member) return null;

    const now = new Date();
    if ((member as any).riskLevel && (member as any).riskCalculatedAt) {
      const hoursSince = (now.getTime() - (member as any).riskCalculatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return { risk: (member as any).riskLevel, reason: (member as any).riskReason };
      }
    }

    let onTime = 0;
    let late = 0;
    let consecutiveMissed = 0;
    let currentMissedRun = 0;
    
    member.enrollments.forEach(enrollment => {
      const sortedPayments = enrollment.payments.sort((a, b) => a.month - b.month);
      sortedPayments.forEach(payment => {
        if (payment.status === 'PAID') {
          if (payment.lateFee > 0) late++;
          else onTime++;
          currentMissedRun = 0;
        } else if (payment.status === 'PARTIAL' || payment.amountPaid === 0) {
          late++;
          currentMissedRun++;
          if (currentMissedRun > consecutiveMissed) consecutiveMissed = currentMissedRun;
        }
      });
    });

    const paymentData = {
      totalPools: member.enrollments.length,
      onTimePayments: onTime,
      lateOrMissedPayments: late,
      maxConsecutiveMissed: consecutiveMissed
    };

    const prompt = `Based on this chit fund member's payment history: ${JSON.stringify(paymentData)}, 
assess their default risk as exactly one of: Low, Medium, or High.
Then give a single short reason (max 15 words).
Respond in JSON format only:
{ "risk": "Low"|"Medium"|"High", "reason": "..." }`;

    const systemPrompt = "You are a precise financial risk assessor answering only in pure JSON format.";
    
    const responseText = await generateAIResponse(systemPrompt, prompt, true);
    if (!responseText) throw new Error("AI returned empty response");

    const parsed = JSON.parse(responseText);
    const risk = parsed.risk || 'Medium';
    const reason = parsed.reason || 'Insufficient data parsing';

    await prisma.member.update({
      where: { id: memberId },
      data: {
        riskLevel: risk,
        riskReason: reason,
        riskCalculatedAt: new Date(),
      } as any
    });

    return { risk, reason };
  } catch (error) {
    console.error('Error in predictDefaultRisk:', error);
    return { risk: 'Unknown', reason: 'Error calculating risk' };
  }
};

export const suggestPotAssignment = async (poolId: string) => {
  try {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        enrollments: {
          where: { potReceived: false }, // Only eligible members
          include: {
            member: {
              include: { enrollments: true } // to count total pools
            },
            payments: true
          }
        }
      }
    });

    if (!pool || pool.enrollments.length === 0) return null;

    // Build stats for Groq
    const eligibleMembers = pool.enrollments.map(enr => {
      let totalDue = 0;
      let totalPaid = 0;
      let onTime = 0;
      let late = 0;
      
      enr.payments.forEach(p => {
        totalDue += p.amountDue;
        totalPaid += p.amountPaid;
        if (p.status === 'PAID' && p.lateFee === 0) onTime++;
        else late++;
      });

      return {
        memberId: enr.member.id,
        name: enr.member.fullName,
        waitingTimeMonths: pool.currentMonth - 1,
        reliabilityPercentage: (onTime + late) > 0 ? Math.round((onTime / (onTime + late)) * 100) : 100,
        creditBalance: totalPaid - totalDue,
        totalPoolsEnrolled: enr.member.enrollments.length
      };
    });

    // If only 1 person, AI isn't really needed, but let's just return it logically
    if (eligibleMembers.length === 1) {
      return { 
        suggestedMemberId: eligibleMembers[0].memberId, 
        reason: 'Only one eligible member remains in the pool.' 
      };
    }

    const payload = { poolName: pool.name, currentMonth: pool.currentMonth, candidates: eligibleMembers };
    
    const prompt = `Given these eligible chit fund members and their payment data: ${JSON.stringify(payload)}.
Suggest EXACTLY ONE memberId who should receive the pot this month. 
Consider payment reliability (higher is better), waiting time, and fairness.
Respond in JSON format only:
{ "suggestedMemberId": "...", "reason": "..." }
Max reason length: 20 words.`;

    const systemPrompt = "You are a fair financial allocator answering only in pure JSON format.";
    
    const responseText = await generateAIResponse(systemPrompt, prompt, true);
    if (!responseText) throw new Error("AI returned empty response");

    const parsed = JSON.parse(responseText);
    
    // Validate that the AI returned a real ID that exists in our list
    const isValid = eligibleMembers.find(m => m.memberId === parsed.suggestedMemberId);
    if (!isValid) throw new Error("AI suggested an invalid member ID.");

    return { 
      suggestedMemberId: parsed.suggestedMemberId, 
      reason: parsed.reason || 'Selected based on optimal reliability and wait time.' 
    };

  } catch (error) {
    console.error('Error in suggestPotAssignment:', error);
    return null; // Silent fallback
  }
};

export const generatePersonalizedReminder = async (memberName: string, totalDue: number, pools: any[], tone: 'Friendly' | 'Urgent' | 'Professional' = 'Friendly') => {
  try {
    const poolsStr = pools.map(p => `${p.poolName} (₹${p.amount.toLocaleString()})`).join(', ');
    
    const prompt = `Write a short, professional WhatsApp reminder for a chit fund member named ${memberName}.
Total Due: ₹${totalDue.toLocaleString()}
Pools: ${poolsStr}
Tone Style: ${tone}

Rules:
1. Max 60 words.
2. Use emojis naturally.
3. Mention the specific pools and total amount.
4. End with 'Thank you, [Company Name]'. (Do not replace [Company Name], I will replace it later).
5. DO NOT include any subject line or headers. Just the message body.`;

    const systemPrompt = "You are a polite business assistant for a chit fund company.";
    
    const message = await generateAIResponse(systemPrompt, prompt);
    return message;
  } catch (error) {
    console.error('Error generating personalized reminder:', error);
    return null;
  }
};

export const generateMonthlySummary = async (monthData: any) => {
  try {
    const prompt = `Generate a monthly business summary for a chit fund owner.
Data for this month:
- Total Collected: ₹${monthData.totalCollected.toLocaleString()}
- Total Pots Paid Out: ₹${monthData.totalPotsPaid.toLocaleString()}
- Total Outstanding (Unpaid): ₹${monthData.totalUnpaid.toLocaleString()}
- Consistency Leaders (Top Members): ${monthData.topPerformers.join(', ')}

Structure:
1. Short overview of the month's health.
2. AI Trend Analysis: What do these numbers suggest?
3. Strategic Suggestions: Give 2 actionable tips to improve collection or growth.
4. Top Performers Shout-out.

Style: Professional, data-driven, yet encouraging.
Language: English (Tamil loan words like 'Chit' are okay).
Max length: 150 words. Format for WhatsApp (use bolding and emojis).`;

    const systemPrompt = "You are a senior business consultant for financial chit funds.";
    
    const summary = await generateAIResponse(systemPrompt, prompt);
    return summary;
  } catch (error) {
    console.error('Error in generateMonthlySummary:', error);
    return null;
  }
};
