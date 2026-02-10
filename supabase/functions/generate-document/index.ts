import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDUSTRY_SECTIONS: Record<string, string[]> = {
  "Healthcare": [
    "Problem Statement",
    "Research Objectives",
    "User Requirements",
    "Regulatory Context (HIPAA/FDA)",
    "Clinical Workflow Analysis",
    "User Personas",
    "FMEA Analysis",
    "Patient Safety Requirements",
    "Cybersecurity Requirements",
    "Research Findings",
    "Design Implications"
  ],
  "Financial Services": [
    "Problem Statement",
    "Research Objectives",
    "User Requirements",
    "Regulatory Compliance (SEC/KYC/AML)",
    "Security & Privacy Requirements",
    "Risk Analysis",
    "User Personas",
    "Fraud Prevention Considerations",
    "Market Analysis",
    "Research Findings",
    "Design Implications"
  ],
  "B2B SaaS": [
    "Problem Statement",
    "Research Objectives",
    "User Requirements",
    "Stakeholder Analysis",
    "Integration Requirements",
    "User Personas",
    "Implementation & Adoption Considerations",
    "ROI & Success Metrics",
    "Market Analysis",
    "Research Findings",
    "Design Implications"
  ],
  "E-commerce": [
    "Problem Statement",
    "Research Objectives",
    "User Requirements",
    "Conversion Funnel Analysis",
    "Cart Abandonment Insights",
    "User Personas",
    "Competitive Benchmarking",
    "Customer Journey Mapping",
    "Market Analysis",
    "Research Findings",
    "Design Implications"
  ],
  "General/Other": [
    "Problem Statement",
    "Research Objectives",
    "User Requirements",
    "Competitive Analysis",
    "User Personas",
    "Technical Constraints",
    "Success Metrics",
    "Market Analysis",
    "Research Findings",
    "Design Implications"
  ]
};

// Descriptions for each section type to guide AI
const SECTION_DESCRIPTIONS: Record<string, string> = {
  "Problem Statement": "Define the core problem with specific impact metrics (e.g., revenue loss, user drop-off rates, support ticket volume). Quantify the business and user impact.",
  "Research Objectives": "List 4-6 specific research questions with measurable success criteria. Specify methods to be used (e.g., 'moderated usability testing with 12 participants across 3 segments') and hypotheses to validate.",
  "User Requirements": "Document functional and non-functional requirements with priority levels (Must-Have, Should-Have, Nice-to-Have). Include specific performance targets and accessibility standards.",
  "Regulatory Context (HIPAA/FDA)": "Outline specific compliance requirements with regulation references (e.g., HIPAA §164.312 for encryption). Include audit trail requirements and data retention policies.",
  "Clinical Workflow Analysis": "Map current vs. proposed workflows with time-on-task measurements. Identify specific pain points with severity ratings and frequency of occurrence.",
  "User Personas": "Create 2-3 detailed personas with name, age, role, tech proficiency, device preferences, behavioral patterns, a direct frustration quote, and primary goals. Base on realistic demographic data.",
  "FMEA Analysis": "Document failure modes with Risk Priority Numbers (RPN = Severity × Occurrence × Detection). Include specific mitigation actions and responsible parties.",
  "Patient Safety Requirements": "Outline safety requirements referencing IEC 62366 usability engineering standards. Include specific risk scenarios with likelihood and severity ratings.",
  "Cybersecurity Requirements": "Detail security requirements per NIST framework. Specify encryption standards, authentication methods, and penetration testing scope.",
  "Research Findings": "Present findings with supporting data points, statistical significance where applicable, and severity ratings (Critical/High/Medium/Low). Cross-reference specific personas affected.",
  "Design Implications": "Translate each research finding into a specific design recommendation. Reference the exact persona pain points and metrics from earlier sections. Include priority and estimated impact.",
  "Regulatory Compliance (SEC/KYC/AML)": "Document specific regulatory requirements with section references. Include compliance testing criteria and audit requirements.",
  "Security & Privacy Requirements": "Specify encryption standards (AES-256, TLS 1.3), authentication requirements (MFA, biometric), data classification levels, and GDPR/CCPA compliance needs.",
  "Risk Analysis": "Assess risks using a probability × impact matrix. Include specific mitigation strategies with owners, timelines, and residual risk levels.",
  "Fraud Prevention Considerations": "Document specific fraud vectors with estimated exposure. Include detection methods, false positive rates, and escalation procedures.",
  "Market Analysis": "Include TAM/SAM/SOM figures, market growth rates, key trends with data sources, and competitive landscape positioning with specific market share data.",
  "Stakeholder Analysis": "Map stakeholders on an influence/interest matrix. Include specific decision-makers, their concerns, preferred communication channels, and sign-off requirements.",
  "Integration Requirements": "Document specific APIs, data formats, latency requirements, and third-party dependencies. Include integration architecture and fallback strategies.",
  "Implementation & Adoption Considerations": "Plan phased rollout with specific milestones, training requirements by user segment, change management tactics, and adoption KPIs.",
  "ROI & Success Metrics": "Define specific KPIs with baseline values, target values, and measurement timelines. Include ROI calculation methodology and break-even analysis.",
  "Conversion Funnel Analysis": "Map each funnel stage with current conversion rates and drop-off points. Include industry benchmarks for comparison and specific optimization opportunities.",
  "Cart Abandonment Insights": "Analyze abandonment by stage with specific rates (e.g., 'shipping page: 23% drop-off'). Include top abandonment reasons from exit surveys and recovery strategies.",
  "Competitive Benchmarking": "Compare 3-5 named competitors on specific UX dimensions. Reference their actual features and approaches (e.g., Amazon's 1-Click, Stripe's progressive onboarding).",
  "Customer Journey Mapping": "Map end-to-end journey with emotional highs/lows, specific touchpoints, channel transitions, and moments of truth. Include time spent at each stage.",
  "Competitive Analysis": "Analyze 3-5 named competitors with specific strengths, weaknesses, and UX approaches. Include feature comparison matrix and differentiation opportunities.",
  "Technical Constraints": "Document specific platform requirements, browser/device support matrix, performance budgets (e.g., LCP < 2.5s), and infrastructure limitations.",
  "Success Metrics": "Define 5-8 specific KPIs with current baselines, target values, measurement methods, and review cadence. Include both leading and lagging indicators."
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !authData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { problemStatement, industry, timeline, targetUsers, additionalContext, importedDocumentAnalysis } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get sections for the industry
    let sections = INDUSTRY_SECTIONS[industry] || INDUSTRY_SECTIONS["General/Other"];

    // If we have an imported document analysis, merge suggested additional sections
    let importedContext = "";
    if (importedDocumentAnalysis) {
      const { existingSections, suggestedAdditionalSections, extractedContent, summary } = importedDocumentAnalysis;
      
      // Add any suggested sections that aren't already in the list
      if (suggestedAdditionalSections?.length) {
        const existingLower = new Set(sections.map((s: string) => s.toLowerCase()));
        for (const suggested of suggestedAdditionalSections) {
          if (!existingLower.has(suggested.title.toLowerCase())) {
            sections.push(suggested.title);
            SECTION_DESCRIPTIONS[suggested.title] = suggested.reason || `Document relevant information for ${suggested.title}.`;
          }
        }
      }

      importedContext = `\n\nIMPORTED DOCUMENT CONTEXT:
The user has imported an existing document. Here's what was found:
Summary: ${summary || "N/A"}
Existing sections found: ${existingSections?.map((s: any) => `${s.title} (${s.summary})`).join(", ") || "None"}
Extracted content is available for some sections. Build upon this content rather than starting from scratch.
${extractedContent ? `\nExtracted content from document:\n${JSON.stringify(extractedContent)}` : ""}`;
    }

    // Build detailed section list with descriptions
    const sectionDetails = sections.map((title: string, index: number) => {
      const desc = SECTION_DESCRIPTIONS[title] || `Document relevant information for ${title}.`;
      return `${index + 1}. "${title}" - ${desc}`;
    }).join('\n');

    const prompt = `Generate a professional UX research document with UNIQUE, RESEARCH-GRADE content for every section below. This should read like a deliverable from a senior UX research consultant — not a generic template.

CRITICAL REQUIREMENTS:
- Each section MUST have COMPLETELY DIFFERENT content — no overlap or repetition.
- Each section should be 150-250 words with substantive depth.
- Include specific, realistic metrics and data points relevant to the ${industry} industry (e.g., actual conversion rates, task completion benchmarks, market figures).
- Every section MUST include at least one actionable recommendation or concrete next step.
- Later sections (Research Findings, Design Implications) MUST cross-reference specific findings from earlier sections by name — cite the exact personas, metrics, or pain points introduced earlier.
- Use precise language: instead of "users struggle" say "67% of participants failed to complete the checkout flow within 3 minutes"; instead of "significant improvement" say "reduce error rate from 23% to below 8%".

SECTION-SPECIFIC DEPTH:
- User Personas: Create realistic personas with name, age, job title, experience level, device preferences, a behavioral pattern, a frustration quote in their own voice, and a key goal.
- Competitive Benchmarking / Competitive Analysis: Name real companies and describe their specific UX approaches (e.g., "Amazon's 1-Click reduces checkout friction; Shopify's Shop Pay achieves 1.72x higher conversion than guest checkout").
- Research Methodology / Research Objectives: Specify exact methods with participant counts and segments (e.g., "moderated usability testing with 12 participants across 3 user segments" not "user testing").
- Research Findings: Present findings with data, severity ratings (Critical/High/Medium/Low), and affected user segments.
- Market Analysis: Include realistic market size, growth rates, and competitive landscape data.

HTML FORMATTING RULES (VERY IMPORTANT):
- Use <h3> for sub-headings within sections
- Use <p> for paragraphs
- Use <strong> for bold/emphasized text
- Use <ul><li> for bullet points
- Do NOT use markdown syntax like ** or ##
- Properly escape quotes in JSON

PROJECT CONTEXT:
Problem Statement: ${problemStatement}
Industry: ${industry}
${timeline ? `Timeline: ${timeline}` : ''}
${targetUsers ? `Target Users: ${targetUsers}` : ''}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}${importedContext}

SECTIONS TO GENERATE (each must be unique and section-specific):
${sectionDetails}

Return valid JSON with exact section names as keys and HTML-formatted content as values:
{
  "Problem Statement": "<h3>...</h3><p>...</p>",
  "Research Objectives": "<h3>...</h3><ul><li>...</li></ul>"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a senior UX research consultant producing a professional research deliverable. Generate unique, deeply specific HTML-formatted content for each document section.\n\nQUALITY STANDARDS:\n- Write at the depth of a professional UX research consultant's deliverable — not generic overviews.\n- Include specific, realistic metrics, percentages, and benchmarks relevant to the industry (e.g., 'cart abandonment rate of 68.7%' not 'high abandonment').\n- Every section MUST contain at least one actionable insight or concrete recommendation.\n- Use precise language — replace vague phrases like 'significant improvement' with specific targets like 'reduce task completion time from 4.2 minutes to under 2 minutes'.\n- Each section MUST cross-reference findings from earlier sections by name. For example, Design Implications must cite specific pain points from User Personas and data from Research Findings.\n\nSECTION-SPECIFIC RULES:\n- User Personas: Include demographic details (age, role, experience level), behavioral patterns, device preferences, tech proficiency, and a direct quote representing the persona's internal monologue.\n- Competitive Benchmarking / Competitive Analysis: Reference real-world companies and their known UX approaches (e.g., Amazon's 1-Click ordering, Shopify's accelerated checkout, Stripe's developer-first onboarding).\n- Research Methodology / Research Objectives: Specify exact methods with sample sizes (e.g., 'moderated usability testing with 12 participants across 3 segments' not 'user testing').\n- Research Findings: Present findings with supporting data points and severity ratings.\n- Market Analysis: Include market size figures, growth rates, and trend data.\n\nFORMATTING:\n- Use HTML tags: <h3>, <p>, <strong>, <ul>, <li>. Never use markdown syntax.\n- Never repeat content between sections.\n- Always return valid JSON with section titles as keys and HTML content as values."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log("AI Response:", content);

    // Parse the JSON response
    let sectionContent: Record<string, string> = {};
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonStr = objectMatch[0];
        }
      }
      sectionContent = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Create unique default content for each section with HTML formatting
      sections.forEach((section) => {
        const desc = SECTION_DESCRIPTIONS[section] || '';
        sectionContent[section] = `<h3>${section}</h3><p>${desc}</p><p>Add your content here. Consider how this relates to: ${problemStatement.slice(0, 100)}...</p>`;
      });
    }

    // Ensure all sections have content and match exact titles
    const result = sections.map((title, index) => {
      // Try to find content with exact match or close match
      let foundContent = sectionContent[title];
      
      // If not found, try case-insensitive or partial match
      if (!foundContent) {
        const lowerTitle = title.toLowerCase();
        for (const [key, value] of Object.entries(sectionContent)) {
          if (key.toLowerCase() === lowerTitle || key.toLowerCase().includes(lowerTitle) || lowerTitle.includes(key.toLowerCase())) {
            foundContent = value;
            break;
          }
        }
      }

      return {
        title,
        content: foundContent || `<h3>${title}</h3><p>${SECTION_DESCRIPTIONS[title] || ''}</p><p>Add your content here...</p>`,
        section_order: index
      };
    });

    return new Response(JSON.stringify({ sections: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-document error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
