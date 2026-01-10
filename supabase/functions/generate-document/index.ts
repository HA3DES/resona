import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { problemStatement, industry, timeline, targetUsers, additionalContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get sections for the industry
    const sections = INDUSTRY_SECTIONS[industry] || INDUSTRY_SECTIONS["General/Other"];

    const prompt = `You are helping create a UX research document. Generate brief starter content for each section below.

Requirements:
- Each section should be 5-10 lines (50-100 words)
- Explain what content belongs in this section
- Include 1-2 light examples relevant to the specific problem statement
- Use bullet points or short paragraphs for readability
- Be helpful but not prescriptive - this is a starting point for the researcher to build on
- Reference the problem statement naturally but don't over-personalize

Problem Statement: ${problemStatement}
Industry: ${industry}
${timeline ? `Timeline: ${timeline}` : ''}
${targetUsers ? `Target Users: ${targetUsers}` : ''}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Generate starter content for these sections:
${sections.join('\n')}

Return as JSON with section names as keys and starter content as values. Use plain text with line breaks for formatting.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful UX research assistant. Always return valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
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
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Parse the JSON response
    let sectionContent: Record<string, string> = {};
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        sectionContent = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Create default content for each section
      sections.forEach(section => {
        sectionContent[section] = `Add your content here for ${section}...`;
      });
    }

    // Ensure all sections have content
    const result = sections.map((title, index) => ({
      title,
      content: sectionContent[title] || `Add your content here for ${title}...`,
      section_order: index
    }));

    return new Response(JSON.stringify({ sections: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
