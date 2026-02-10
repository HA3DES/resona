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

    // Validate MIME type server-side
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream", // fallback for some browsers
    ];
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Unsupported file type." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 10MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(arrayBuffer);
    let extractedText = "";

    // Limits for safe processing
    const MAX_MATCHES = 5000;
    const MAX_EXTRACTED_LENGTH = 200_000;
    const MAX_STREAM_COUNT = 500;
    const PROCESSING_TIMEOUT_MS = 15_000; // 15s timeout for document parsing
    const processingStart = Date.now();

    if (fileName.endsWith(".pdf")) {
      // Validate PDF magic bytes: %PDF-
      if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) {
        return new Response(JSON.stringify({ error: "Invalid PDF file." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const decoder = new TextDecoder("latin1");
      const rawText = decoder.decode(bytes);

      // Extract text between parentheses with iteration limit
      const textMatches = rawText.match(/\(([^)]+)\)/g);
      if (textMatches) {
        const limited = textMatches.slice(0, MAX_MATCHES);
        extractedText = limited
          .map((m) => m.slice(1, -1))
          .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t))
          .join(" ");
      }

      // Extract from streams with count limit and timeout
      const streamMatches = rawText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
      if (streamMatches) {
        const limitedStreams = streamMatches.slice(0, MAX_STREAM_COUNT);
        for (const stream of limitedStreams) {
          if (extractedText.length >= MAX_EXTRACTED_LENGTH) break;
          if (Date.now() - processingStart > PROCESSING_TIMEOUT_MS) {
            console.warn("Document processing timeout reached during PDF stream extraction");
            break;
          }
          const readable = stream.replace(/stream\r?\n/, "").replace(/\r?\nendstream/, "");
          // Skip very large streams (likely binary/image data)
          if (readable.length > 100_000) continue;
          const textParts = readable.match(/\(([^)]+)\)/g);
          if (textParts) {
            const streamText = textParts.slice(0, MAX_MATCHES)
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
      // DOCX validation: must start with ZIP magic bytes (PK\x03\x04)
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
        return new Response(JSON.stringify({ error: "Invalid DOCX file." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify this is actually an Office Open XML document, not just any ZIP
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const rawContent = decoder.decode(bytes);
      const hasOfficeMarkers = rawContent.includes("[Content_Types].xml") || 
                                rawContent.includes("word/document.xml") ||
                                rawContent.includes("word/_rels");
      if (!hasOfficeMarkers) {
        return new Response(JSON.stringify({ error: "Invalid DOCX file. The file does not contain valid Office document structure." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {

        // Limit decoded content to prevent memory issues
        const safeContent = rawContent.length > MAX_EXTRACTED_LENGTH
          ? rawContent.substring(0, MAX_EXTRACTED_LENGTH)
          : rawContent;

        const textContent = safeContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        const words = textContent.split(" ").filter((w) => /^[a-zA-Z0-9.,!?;:'"()-]+$/.test(w));
        extractedText = words.slice(0, 50_000).join(" ");

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
      return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
