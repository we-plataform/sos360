"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ScoringCriteria {
  jobTitles: {
    target: string[];
    exclude: string[];
    seniority: string[];
  };
  companies: {
    industries: string[];
    sizes: string[];
    excludeIndustries: string[];
  };
  engagement: {
    minFollowers?: number;
    minConnections?: number;
    hasRecentPosts?: boolean;
  };
  completeness: {
    required: string[];
    bonus: string[];
  };
}

interface ScoringWeights {
  jobTitle: number;
  company: number;
  engagement: number;
  completeness: number;
}

interface ScoringModelEditorProps {
  pipelineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const defaultCriteria: ScoringCriteria = {
  jobTitles: {
    target: [],
    exclude: [],
    seniority: ["C-level", "VP", "Director", "Manager", "Senior"],
  },
  companies: {
    industries: [],
    sizes: [],
    excludeIndustries: [],
  },
  engagement: {
    hasRecentPosts: true,
  },
  completeness: {
    required: ["email", "jobTitle", "company", "bio"],
    bonus: ["phone", "website", "experience"],
  },
};

const defaultWeights: ScoringWeights = {
  jobTitle: 1.0,
  company: 1.0,
  engagement: 0.8,
  completeness: 0.6,
};

export function ScoringModelEditor({
  pipelineId,
  open,
  onOpenChange,
  onSave,
}: ScoringModelEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [criteria, setCriteria] = useState<ScoringCriteria>(defaultCriteria);
  const [weights, setWeights] = useState<ScoringWeights>(defaultWeights);
  const [thresholdHigh, setThresholdHigh] = useState(80);
  const [thresholdMedium, setThresholdMedium] = useState(50);

  // Temporary state for adding new items
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newExcludeIndustry, setNewExcludeIndustry] = useState("");

  useEffect(() => {
    if (open && pipelineId) {
      fetchScoringModel();
    }
  }, [open, pipelineId]);

  const fetchScoringModel = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/v1/pipelines/${pipelineId}/scoring-model`,
      );
      if (response.data.success && response.data.data) {
        const model = response.data.data;
        setName(model.name);
        setDescription(model.description || "");
        setEnabled(model.enabled);
        setCriteria(model.criteria);
        setWeights(model.weights);
        setThresholdHigh(model.thresholdHigh);
        setThresholdMedium(model.thresholdMedium);
      }
    } catch (error) {
      console.error("Failed to fetch scoring model:", error);
      // Set defaults if no model exists
      setName("Default Scoring Model");
      setDescription("");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/api/v1/pipelines/${pipelineId}/scoring-model`, {
        name,
        description,
        enabled,
        criteria,
        weights,
        thresholdHigh,
        thresholdMedium,
      });
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save scoring model:", error);
    } finally {
      setSaving(false);
    }
  };

  const addToList = (
    category: keyof ScoringCriteria,
    field: string,
    value: string,
  ) => {
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [field]: [...((prev[category] as any)[field] as string[]), value],
      },
    }));
  };

  const removeFromList = (
    category: keyof ScoringCriteria,
    field: string,
    index: number,
  ) => {
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [field]: ((prev[category] as any)[field] as string[]).filter(
          (_, i) => i !== index,
        ),
      },
    }));
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scoring Model Configuration</DialogTitle>
          <DialogDescription>
            Define how leads should be scored based on your ideal customer
            profile (ICP).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enable Scoring</Label>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Model Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Enterprise Sales Model"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your ideal customer profile..."
                rows={2}
              />
            </div>
          </div>

          {/* Job Titles */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Job Title Criteria</h3>

            <div className="space-y-2">
              <Label>Target Job Titles</Label>
              <div className="flex gap-2">
                <Input
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g., CEO, CTO"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newJobTitle) {
                      addToList("jobTitles", "target", newJobTitle);
                      setNewJobTitle("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (newJobTitle) {
                      addToList("jobTitles", "target", newJobTitle);
                      setNewJobTitle("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {criteria.jobTitles.target.map((title, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {title}
                    <button
                      type="button"
                      onClick={() => removeFromList("jobTitles", "target", i)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Companies */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Company Criteria</h3>

            <div className="space-y-2">
              <Label>Target Industries</Label>
              <div className="flex gap-2">
                <Input
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  placeholder="e.g., SaaS, Technology"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newIndustry) {
                      addToList("companies", "industries", newIndustry);
                      setNewIndustry("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (newIndustry) {
                      addToList("companies", "industries", newIndustry);
                      setNewIndustry("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {criteria.companies.industries.map((ind, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {ind}
                    <button
                      type="button"
                      onClick={() =>
                        removeFromList("companies", "industries", i)
                      }
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Weights */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Scoring Weights</h3>
            {Object.entries(weights).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="capitalize">{key}</Label>
                  <span className="text-sm text-muted-foreground">
                    {value.toFixed(1)}x
                  </span>
                </div>
                <Slider
                  value={[value]}
                  onValueChange={([newValue]) =>
                    setWeights((prev) => ({ ...prev, [key]: newValue }))
                  }
                  min={0}
                  max={2}
                  step={0.1}
                  className="flex-1"
                />
              </div>
            ))}
          </div>

          {/* Thresholds */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Score Thresholds</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hot Lead (≥)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholdHigh}
                  onChange={(e) => setThresholdHigh(parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Warm Lead (≥)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholdMedium}
                  onChange={(e) => setThresholdMedium(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Model"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
