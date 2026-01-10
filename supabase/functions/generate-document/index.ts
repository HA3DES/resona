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

// Descriptions for each section type to guide AI
const SECTION_DESCRIPTIONS: Record<string, string> = {
  "Problem Statement": "Define the core problem being investigated. State the issue clearly and explain its impact.",
  "Research Objectives": "List specific goals, questions, and hypotheses this research will answer.",
  "User Requirements": "Document what users need from the solution - functional and non-functional requirements.",
  "Regulatory Context (HIPAA/FDA)": "Outline compliance requirements, regulatory considerations, and legal constraints.",
  "Clinical Workflow Analysis": "Map current workflows, processes, and identify pain points in clinical settings.",
  "User Personas": "Describe key user types, their characteristics, goals, and pain points.",
  "FMEA Analysis": "Document failure modes, effects analysis, and risk assessment.",
  "Patient Safety Requirements": "Outline safety considerations, risk mitigation, and patient protection needs.",
  "Cybersecurity Requirements": "Detail security requirements, data protection, and threat considerations.",
  "Research Findings": "Space for documenting research results, insights, and data collected.",
  "Design Implications": "How findings translate to design decisions and recommendations.",
  "Regulatory Compliance (SEC/KYC/AML)": "Document compliance requirements for financial regulations.",
  "Security & Privacy Requirements": "Outline data security and user privacy requirements.",
  "Risk Analysis": "Assess potential risks and mitigation strategies.",
  "Fraud Prevention Considerations": "Document fraud risks and prevention measures.",
  "Market Analysis": "Analyze market conditions, competitors, and opportunities.",
  "Stakeholder Analysis": "Identify and analyze key stakeholders and their interests.",
  "Integration Requirements": "Document technical integration needs and dependencies.",
  "Implementation & Adoption Considerations": "Plan for rollout, training, and user adoption.",
  "ROI & Success Metrics": "Define success criteria and expected return on investment.",
  "Conversion Funnel Analysis": "Analyze user journey through conversion steps.",
  "Cart Abandonment Insights": "Investigate why users abandon carts and potential solutions.",
  "Competitive Benchmarking": "Compare against competitors and industry standards.",
  "Customer Journey Mapping": "Map the complete customer experience journey.",
  "Competitive Analysis": "Analyze competitors, their strengths and weaknesses.",
  "Technical Constraints": "Document technical limitations and requirements.",
  "Success Metrics": "Define how success will be measured."
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

    // Build detailed section list with descriptions
    const sectionDetails = sections.map((title, index) => {
      const desc = SECTION_DESCRIPTIONS[title] || `Document relevant information for ${title}.`;
      return `${index + 1}. "${title}" - ${desc}`;
    }).join('\n');

    const prompt = `You are a UX research expert helping create a comprehensive research document. Generate UNIQUE and SPECIFIC starter content for EACH section listed below.

CRITICAL REQUIREMENTS:
- Each section MUST have COMPLETELY DIFFERENT content
- Content must be specific to that section's purpose
- Each section should be 5-10 lines (50-100 words)
- Include 1-2 concrete examples relevant to the problem statement AND the specific section
- Use bullet points or short paragraphs for readability
- Reference the problem statement naturally throughout
- Make content actionable and helpful as a starting point

PROJECT CONTEXT:
Problem Statement: ${problemStatement}
Industry: ${industry}
${timeline ? `Timeline: ${timeline}` : ''}
${targetUsers ? `Target Users: ${targetUsers}` : ''}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

SECTIONS TO GENERATE (each must be unique and section-specific):
${sectionDetails}

IMPORTANT: Return valid JSON with exact section names as keys. Each section's content must be distinctly different, focused on its specific purpose, and tailored to the project context.

Example format:
{
  "Problem Statement": "Content specifically about defining the problem...",
  "Research Objectives": "DIFFERENT content about research goals and questions...",
  "User Requirements": "DIFFERENT content about user needs..."
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
            content: "You are an expert UX researcher. Generate unique, specific content for each document section. Never repeat content between sections. Always return valid JSON with section titles as keys." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 6000,
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
      // Create unique default content for each section
      sections.forEach((section, index) => {
        const desc = SECTION_DESCRIPTIONS[section] || '';
        sectionContent[section] = `${desc}\n\nAdd your content here for ${section}. Consider how this relates to: ${problemStatement.slice(0, 100)}...`;
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
        content: foundContent || `${SECTION_DESCRIPTIONS[title] || ''}\n\nAdd your content here for ${title}...`,
        section_order: index
      };
    });

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
