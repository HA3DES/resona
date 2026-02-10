import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !authData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = file.name.toLowerCase();
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const hasValidExtension = allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Please upload PDF, DOC, or DOCX files." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read file content as text - for PDFs we extract what we can
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    let extractedText = "";

    if (fileName.endsWith(".pdf")) {
      // Basic PDF text extraction - look for text streams
      const decoder = new TextDecoder("latin1");
      const rawText = decoder.decode(bytes);
      
      // Extract text between BT and ET operators (basic PDF text extraction)
      const textMatches = rawText.match(/\(([^)]+)\)/g);
      if (textMatches) {
        extractedText = textMatches
          .map((m) => m.slice(1, -1))
          .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t))
          .join(" ");
      }

      // Also try to get text from streams
      const streamMatches = rawText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
      if (streamMatches) {
        for (const stream of streamMatches) {
          const readable = stream.replace(/stream\r?\n/, "").replace(/\r?\nendstream/, "");
          const textParts = readable.match(/\(([^)]+)\)/g);
          if (textParts) {
            const streamText = textParts
              .map((m) => m.slice(1, -1))
              .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t))
              .join(" ");
            if (streamText.length > extractedText.length) {
              extractedText = streamText;
            }
          }
        }
      }

      if (!extractedText.trim()) {
        extractedText = "[PDF content could not be fully extracted. The AI will analyze based on the filename and any available metadata.]";
      }
    } else {
      // For DOCX files, extract XML content
      // DOCX is a ZIP file containing XML
      try {
        // Try to find document.xml content in the DOCX zip
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const rawContent = decoder.decode(bytes);
        
        // Extract text from XML tags
        const textContent = rawContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        
        // Filter to readable portions
        const words = textContent.split(" ").filter((w) => /^[a-zA-Z0-9.,!?;:'"()-]+$/.test(w));
        extractedText = words.join(" ");

        if (extractedText.length < 50) {
          extractedText = `[Document: ${file.name}. Content extraction was limited. The AI will infer structure from available text.]`;
        }
      } catch {
        extractedText = `[Document: ${file.name}. Unable to extract text content directly.]`;
      }
    }

    // Truncate to reasonable size for AI
    const maxLength = 8000;
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + "... [truncated]";
    }

    console.log(`Extracted ${extractedText.length} chars from ${file.name}`);

    // Use AI to analyze the document and suggest sections
    const analysisPrompt = `You are a UX research document analyst. A user has uploaded an existing document to create a new research project. Analyze the extracted text content and:

1. Summarize what the document is about (2-3 sentences)
2. Identify the industry/domain (one of: Healthcare, Financial Services, B2B SaaS, E-commerce, General/Other)
3. Extract the core problem statement from the document
4. List what sections/topics are ALREADY covered in the document
5. Predict what ADDITIONAL sections would be needed for a complete UX research document

DOCUMENT FILENAME: ${file.name}
EXTRACTED TEXT:
${extractedText}

Return valid JSON in this exact format:
{
  "summary": "Brief summary of the document",
  "detectedIndustry": "Healthcare|Financial Services|B2B SaaS|E-commerce|General/Other",
  "extractedProblemStatement": "The core problem from the document",
  "existingSections": [
    {"title": "Section name", "summary": "Brief description of what's covered"}
  ],
  "suggestedAdditionalSections": [
    {"title": "Section name", "reason": "Why this section is needed"}
  ],
  "extractedContent": {
    "Section Title": "Content extracted or inferred for this section in HTML format"
  }
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
            content: "You are an expert UX research analyst. Analyze documents and identify their structure, content, and what additional research sections would make the document complete. Always return valid JSON.",
          },
          { role: "user", content: analysisPrompt },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let analysis;
    try {
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
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI analysis:", parseError);
      analysis = {
        summary: "Document was uploaded but could not be fully analyzed.",
        detectedIndustry: "General/Other",
        extractedProblemStatement: "",
        existingSections: [],
        suggestedAdditionalSections: [],
        extractedContent: {},
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
