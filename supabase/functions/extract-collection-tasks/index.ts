import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskExtraction {
  task_type: string;
  priority: string;
  summary: string;
  details: string;
  recommended_action: string;
  due_days: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { activity_id, message, debtor_id, invoice_id } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    console.log('Extracting tasks from message:', message.substring(0, 100));

    // Call Lovable AI to extract tasks
    const systemPrompt = `You are an expert collections analyst. Analyze customer responses and extract actionable tasks.

Identify tasks such as:
- w9_request: Customer requests W9 tax form
- payment_plan_needed: Customer needs payment arrangement
- incorrect_po: Dispute over wrong purchase order number
- dispute_charges: Dispute over incorrect amounts or charges
- invoice_copy_request: Customer needs invoice resent
- billing_address_update: Address needs correction
- payment_method_update: Payment details need updating
- service_not_delivered: Claims service/product not received
- overpayment_inquiry: Questions about double charges or overpayment
- paid_verification: Claims already paid, needs verification
- extension_request: Asks for payment deadline extension
- callback_required: Requests phone call or meeting

For each task found, provide:
- task_type (from list above)
- priority (low/normal/high/urgent)
- summary (brief 1-line description)
- details (full explanation)
- recommended_action (specific next steps)
- due_days (number of business days until due, default 2)

Return a JSON array of tasks. If no actionable tasks found, return empty array.`;

    const userPrompt = `Analyze this customer response and extract actionable tasks:

"${message}"

Return tasks as JSON array.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_tasks',
            description: 'Extract actionable tasks from customer message',
            parameters: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      task_type: { 
                        type: 'string',
                        enum: ['w9_request', 'payment_plan_needed', 'incorrect_po', 'dispute_charges', 
                               'invoice_copy_request', 'billing_address_update', 'payment_method_update',
                               'service_not_delivered', 'overpayment_inquiry', 'paid_verification',
                               'extension_request', 'callback_required']
                      },
                      priority: { 
                        type: 'string',
                        enum: ['low', 'normal', 'high', 'urgent']
                      },
                      summary: { type: 'string' },
                      details: { type: 'string' },
                      recommended_action: { type: 'string' },
                      due_days: { type: 'number', default: 2 }
                    },
                    required: ['task_type', 'priority', 'summary', 'details', 'recommended_action']
                  }
                }
              },
              required: ['tasks']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_tasks' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));

    // Extract tasks from tool call response
    let extractedTasks: TaskExtraction[] = [];
    
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]) {
      const toolCall = aiData.choices[0].message.tool_calls[0];
      const args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      
      extractedTasks = args.tasks || [];
    }

    console.log(`Extracted ${extractedTasks.length} tasks`);

    // Create collection_tasks records
    const createdTasks = [];
    
    for (const task of extractedTasks) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (task.due_days || 2));

      const { data: newTask, error: taskError } = await supabase
        .from('collection_tasks')
        .insert({
          user_id: user.id,
          debtor_id,
          invoice_id,
          activity_id,
          task_type: task.task_type,
          priority: task.priority,
          status: 'open',
          summary: task.summary,
          details: task.details,
          ai_reasoning: `Extracted from customer response: "${message.substring(0, 100)}..."`,
          recommended_action: task.recommended_action,
          due_date: dueDate.toISOString().split('T')[0]
        })
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        continue;
      }

      createdTasks.push(newTask);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        tasks_found: extractedTasks.length,
        tasks_created: createdTasks.length,
        tasks: createdTasks
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in extract-collection-tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});