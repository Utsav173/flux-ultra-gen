"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { getApiKey, getState, saveState } from "@/lib/indexDbUtils";
import TooltipComponent from "@/components/TooltipComponent";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiKeyModal } from "@/components/ApiKeyModal";

const MAX_RETRIES = 30;
const POLLING_INTERVAL = 2000;

type FluxApiStatus =
  | "Task not found"
  | "Pending"
  | "Request Moderated"
  | "Content Moderated"
  | "Ready"
  | "Error";

interface FluxApiResponse {
  id: string;
  status: FluxApiStatus;
  result?: {
    sample: string;
    prompt: string;
    seed: number;
    start_time: number;
    end_time: number;
    duration: number;
  };
}

type FluxModel =
  | "flux-pro"
  | "flux-pro-1.1"
  | "flux-dev"
  | "flux-pro-1.1-ultra";

const FLUX_MODAL = {
  FLUX_DEV: "flux-dev",
  FLUX_PRO: "flux-pro",
  FLUX_PRO_1_1: "flux-pro-1.1",
  FLUX_PRO_1_1_ULTRA: "flux-pro-1.1-ultra",
};

const MODAL_VALUE_MAP = {
  [FLUX_MODAL.FLUX_DEV]: "Flux Dev",
  [FLUX_MODAL.FLUX_PRO]: "Flux Pro",
  [FLUX_MODAL.FLUX_PRO_1_1]: "Flux Pro 1.1",
  [FLUX_MODAL.FLUX_PRO_1_1_ULTRA]: "Flux Pro 1.1 Ultra",
};

type ImageSize = {
  width: number;
  height: number;
};

const POSSIBLE_WIDTHS = [256, 1024, 1440];
const POSSIBLE_HEIGHTS = [256, 1440, 768];
const OUTPUT_FORMAT = ["jpeg", "png"];
const ASPECT_RATIO = ["21:9", "16:9", "4:3", "3:4", "9:16", "9:21"];

const SIZE_COMBINATIONS = POSSIBLE_WIDTHS.flatMap((width) =>
  POSSIBLE_HEIGHTS.map((height) => ({ width, height }))
);

const Page = () => {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [model, setModel] = useState<FluxModel>("flux-pro");
  const [size, setSize] = useState<ImageSize>({
    width: POSSIBLE_WIDTHS[0],
    height: POSSIBLE_HEIGHTS[0],
  });
  const [steps, setSteps] = useState<number>(40);
  const [guidance, setGuidance] = useState<number>(2.5);
  const [promptUpsampling, setPromptUpsampling] = useState<boolean>(false);
  const [rawMode, setRawMode] = useState<boolean>(false);

  const [safetyTolerance, setSafetyTolerance] = useState<number>(2);
  const [outputFormat, setOutputFormat] = useState<string>("jpeg");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");

  const pollIdRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const loadState = async () => {
      const savedState = await getState();
      if (savedState) {
        setPrompt(savedState.prompt || "");
        setImage(savedState.image || null);
        setModel(savedState.model || "flux-pro");
        setSize(
          savedState.size || {
            width: POSSIBLE_WIDTHS[0],
            height: POSSIBLE_HEIGHTS[0],
          }
        );
        setSteps(savedState.steps || 40);
        setGuidance(savedState.guidance || 2.5);
        setPromptUpsampling(savedState.prompt_upsampling || false);
        setSafetyTolerance(savedState.safety_tolerance || 2);
        setOutputFormat(savedState.output_format || "jpeg");
        setAspectRatio(savedState.aspect_ratio || "16:9");
      }
    };
    loadState();
  }, []);

  useEffect(() => {
    const save = async () => {
      await saveState({
        prompt,
        image,
        model,
        size,
        steps,
        guidance,
        prompt_upsampling: promptUpsampling,
        safety_tolerance: safetyTolerance,
        output_format: outputFormat,
        aspect_ratio: aspectRatio,
      });
    };
    save();
  }, [
    prompt,
    image,
    model,
    size,
    steps,
    guidance,
    promptUpsampling,
    safetyTolerance,
    outputFormat,
    aspectRatio,
  ]);

  useEffect(() => {
    // Select the body element
    const bodyElement = document.body;

    // Add a dynamic background image with blur using pseudo-element
    bodyElement.style.position = "relative";

    // Add a `::before` style dynamically
    const style = document.createElement("style");
    style.textContent = `
      body::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: url(${image}) no-repeat center center / cover;
        filter: blur(55px);
        z-index: -1;
      }
    `;
    document.head.appendChild(style);

    // Cleanup function
    return () => {
      document.head.removeChild(style);
    };
  }, [image]);

  const checkResult = async (id: string) => {
    if (pollCountRef.current >= MAX_RETRIES) {
      setError("Image generation timed out. Please try again.");
      setLoading(false);
      pollIdRef.current = null; // Cleanup
      return;
    }

    try {
      const resultResponse = await fetch(
        `https://api.bfl.ml/v1/get_result?id=${id}`
      );

      if (!resultResponse.ok) {
        throw new Error(`API error: ${resultResponse.status}`);
      }

      const data: FluxApiResponse = await resultResponse.json();

      switch (data.status) {
        case "Ready":
          if (data.result?.sample) {
            setImage(data.result.sample);
            setLoading(false);
          } else {
            throw new Error("No image in response");
          }
          pollIdRef.current = null; // Cleanup
          break;
        case "Error":
        case "Task not found":
        case "Request Moderated":
        case "Content Moderated":
          throw new Error(`Generation failed: ${data.status}`);
        case "Pending":
          pollCountRef.current += 1;
          setPollCount(pollCountRef.current);
          setTimeout(() => checkResult(id), POLLING_INTERVAL);
          break;
        default:
          throw new Error(`Unknown status: ${data.status}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error checking image status"
      );
      setLoading(false);
      pollIdRef.current = null; // Cleanup
    }
  };

  const handleDownload = () => {
    if (!image) return;

    // Create a temporary link element
    const link = document.createElement("a");
    link.href = image;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.download = `generated-${timestamp}.png`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const generateImage = async () => {
    const apiKey = await getApiKey();

    if (!apiKey) {
      setError("API key not configured");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setError(null);
    setImage(null);
    setPollCount(0);
    pollCountRef.current = 0;

    const extraProperties =
      model === FLUX_MODAL.FLUX_PRO_1_1_ULTRA
        ? {
            raw: rawMode,
            aspect_ratio: aspectRatio,
          }
        : {
            width: size.width,
            height: size.height,
            steps,
            guidance,
          };

    try {
      const initialResponse = await fetch(`https://api.bfl.ml/v1/${model}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Key": apiKey,
        },
        body: JSON.stringify({
          prompt,
          prompt_upsampling: promptUpsampling,
          seed: Math.floor(Math.random() * 1000000),
          safety_tolerance: safetyTolerance,
          interval: 2,
          output_format: outputFormat,
          ...extraProperties,
        }),
      });

      if (!initialResponse.ok) {
        const errorData = await initialResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error: ${initialResponse.status}`
        );
      }

      const { id } = await initialResponse.json();
      pollIdRef.current = id;
      checkResult(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating image");
      setLoading(false);
    }
  };

  const onModelChange = (value: string) => {
    setModel(value as FluxModel);
  };

  const onSizeChange = (size: string) => {
    const [width, height] = size.split("x").map(Number);
    setSize({ width, height });
  };

  const onOutputFormatChange = (value: string) => {
    setOutputFormat(value as (typeof OUTPUT_FORMAT)[number]);
  };

  const onAspectRatioChange = (value: string) => {
    setAspectRatio(value);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="min-h-screen p-8 main-container">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Flux Image Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                {/* Prompt input */}
                <div className="flex gap-4 max-md:flex-col">
                  <Textarea
                    placeholder="Enter your image prompt..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        generateImage();
                      }
                    }}
                    className="flex-grow min-h-20 max-h-52"
                    disabled={loading}
                  />
                  <div className="flex flex-col gap-3 max-md:flex-row max-md:justify-between max-sm:flex-col">
                    <Button
                      onClick={generateImage}
                      disabled={loading}
                      className="min-w-[120px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {`${Math.round((pollCount / MAX_RETRIES) * 100)}%`}
                        </>
                      ) : (
                        "Generate"
                      )}
                    </Button>
                    <div className="flex items-center gap-1.5 max-sm:mx-auto">
                      <TooltipComponent tooltip="Whether to perform upsampling on the prompt. If active, automatically modifies the prompt for more creative generation.">
                        <Label
                          className="text-nowrap"
                          htmlFor="magic_prompt_id"
                        >
                          Magic Prompt
                        </Label>
                      </TooltipComponent>

                      <Switch
                        id="magic_prompt_id"
                        checked={promptUpsampling}
                        onCheckedChange={() =>
                          setPromptUpsampling(!promptUpsampling)
                        }
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Model and size selection */}
                <div className="flex gap-4 max-md:flex-col">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="modal_id">Model</Label>
                    <Select onValueChange={onModelChange} disabled={loading}>
                      <SelectTrigger className="w-[100%]" id="modal_id">
                        <SelectValue placeholder={model} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODAL_VALUE_MAP).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="size_id">
                      {model === FLUX_MODAL.FLUX_PRO_1_1_ULTRA
                        ? "Aspect Ratio"
                        : "Resolution"}
                    </Label>
                    <Select
                      onValueChange={
                        model === FLUX_MODAL.FLUX_PRO_1_1_ULTRA
                          ? onAspectRatioChange
                          : onSizeChange
                      }
                      disabled={loading}
                    >
                      <SelectTrigger className="w-[100%]" id="size_id">
                        <SelectValue
                          placeholder={
                            model === FLUX_MODAL.FLUX_PRO_1_1_ULTRA
                              ? aspectRatio
                              : `${size.width} x ${size.height}`
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {model === FLUX_MODAL.FLUX_PRO_1_1_ULTRA
                          ? ASPECT_RATIO.map((ratio) => (
                              <SelectItem key={ratio} value={ratio}>
                                {ratio}
                              </SelectItem>
                            ))
                          : SIZE_COMBINATIONS.map(({ width, height }) => (
                              <SelectItem
                                key={`${width}x${height}`}
                                value={`${width}x${height}`}
                              >
                                {`${width} x ${height}`}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="output_format_id">Output Format</Label>
                    <Select
                      onValueChange={onOutputFormatChange}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-[100%]" id="output_format_id">
                        <SelectValue placeholder={outputFormat} />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_FORMAT.map((format) => (
                          <SelectItem key={format} value={format}>
                            {format}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {model === FLUX_MODAL.FLUX_PRO_1_1_ULTRA && (
                    <div className="grid grid-flow-row gap-1.5 items-center justify-items-center max-md:grid-flow-col max-md:justify-center">
                      <TooltipComponent tooltip="Generate less processed, more natural-looking images">
                        <Label className="text-nowrap" htmlFor="raw_mode_id">
                          Raw Mode
                        </Label>
                      </TooltipComponent>

                      <Switch
                        id="raw_mode_id"
                        checked={rawMode}
                        onCheckedChange={() => setRawMode(!rawMode)}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>

                {/* Steps and guidance sliders */}
                <div className="flex gap-4 max-md:flex-col">
                  {model !== FLUX_MODAL.FLUX_PRO_1_1_ULTRA && (
                    <>
                      <div className="w-full">
                        <TooltipComponent tooltip="Min: 1 - Max: 50">
                          <Label htmlFor="step_id">
                            Steps <b>{steps}</b>
                          </Label>
                        </TooltipComponent>
                        <Slider
                          id="step_id"
                          value={[steps]}
                          onValueChange={(value) => setSteps(value[0])}
                          min={1}
                          max={50}
                          step={1}
                          disabled={loading}
                        />
                      </div>

                      <div className="w-full">
                        <TooltipComponent tooltip="Min: 1.5 - Max: 5">
                          <Label htmlFor="guidance_id">
                            Guidance <b>{guidance}</b>
                          </Label>
                        </TooltipComponent>
                        <Slider
                          id="guidance_id"
                          value={[guidance]}
                          onValueChange={(value) => setGuidance(value[0])}
                          min={1.5}
                          max={5}
                          step={0.1}
                          disabled={loading}
                        />
                      </div>
                    </>
                  )}

                  <div className="w-full">
                    <TooltipComponent tooltip="Tolerance level for input and output moderation. 0 being most strict, 6 being least strict.">
                      <Label htmlFor="safey_id">
                        Saftey Tolerance <b>{safetyTolerance}</b>
                      </Label>
                    </TooltipComponent>
                    <Slider
                      id="safey_id"
                      value={[safetyTolerance]}
                      onValueChange={(value) => setSafetyTolerance(value[0])}
                      min={0}
                      max={6}
                      step={1}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {error && <div className="text-red-500 text-sm">{error}</div>}

              {image && (
                <div className="mt-6">
                  <img
                    src={image}
                    alt="Generated"
                    className="w-full rounded-lg shadow-lg"
                    loading="lazy"
                    onClick={handleDownload}
                  />
                </div>
              )}

              {!image && !loading && (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">
                    Generated image will appear here
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ApiKeyModal />
    </Suspense>
  );
};

export default Page;
