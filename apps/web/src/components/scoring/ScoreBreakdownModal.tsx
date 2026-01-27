'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ScoreFactor {
  score: number;
  reason: string;
}

interface ScoreBreakdown {
  jobTitle: ScoreFactor;
  company: ScoreFactor;
  engagement: ScoreFactor;
  completeness: ScoreFactor;
}

interface ScoreHistoryEntry {
  id: string;
  oldScore: number | null;
  newScore: number;
  reason: string | null;
  factors: ScoreBreakdown;
  triggeredBy: string;
  createdAt: string;
}

interface ScoreBreakdownModalProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoreBreakdownModal({
  leadId,
  open,
  onOpenChange,
}: ScoreBreakdownModalProps) {
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);
  const [rescoreLoading, setRescoreLoading] = useState(false);

  useEffect(() => {
    if (open && leadId) {
      fetchScoreData();
    }
  }, [open, leadId]);

  const fetchScoreData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/v1/leads/${leadId}/score-breakdown`);
      if (response.data.success) {
        setBreakdown(response.data.data);
        setHistory(response.data.data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch score breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRescore = async () => {
    setRescoreLoading(true);
    try {
      const response = await api.post(`/api/v1/leads/${leadId}/rescore`, {
        force: true,
      });
      if (response.data.success) {
        setBreakdown(response.data.data);
        // Refresh history
        await fetchScoreData();
      }
    } catch (error) {
      console.error('Failed to rescore lead:', error);
    } finally {
      setRescoreLoading(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!breakdown) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Score Breakdown</DialogTitle>
            <DialogDescription>
              No scoring data available. Make sure a scoring model is configured for this pipeline.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const factorLabels: Record<keyof ScoreBreakdown, string> = {
    jobTitle: 'Job Title Match',
    company: 'Company Relevance',
    engagement: 'Engagement & Activity',
    completeness: 'Profile Completeness',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Score Breakdown</span>
            <Badge
              variant={breakdown.score >= 80 ? 'default' : breakdown.score >= 50 ? 'secondary' : 'destructive'}
              className="text-lg px-4 py-1"
            >
              {breakdown.score}/100
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>{breakdown.reason}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRescore}
              disabled={rescoreLoading}
              className="ml-4"
            >
              {rescoreLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rescoring...
                </>
              ) : (
                'Rescore'
              )}
            </Button>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Factor Scores */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Factor Scores</h3>
            {(Object.keys(breakdown.factors) as Array<keyof ScoreBreakdown>).map((factor) => {
              const factorData = breakdown.factors[factor];
              return (
                <div key={factor} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{factorLabels[factor]}</span>
                    <span className="font-bold">{factorData.score}/100</span>
                  </div>
                  <Progress value={factorData.score} className="h-2" />
                  <p className="text-xs text-muted-foreground">{factorData.reason}</p>
                </div>
              );
            })}
          </div>

          {/* Score History */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Score History</h3>
              <div className="space-y-2">
                {history.slice(0, 5).map((entry) => {
                  const scoreChange = entry.oldScore
                    ? entry.newScore - entry.oldScore
                    : null;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-col items-center gap-1 min-w-[60px]">
                        <Badge variant="outline" className="font-bold">
                          {entry.newScore}
                        </Badge>
                        {scoreChange !== null && (
                          <div
                            className={cn(
                              'flex items-center text-xs font-semibold',
                              scoreChange > 0 && 'text-green-600',
                              scoreChange < 0 && 'text-red-600',
                              scoreChange === 0 && 'text-muted-foreground'
                            )}
                          >
                            {scoreChange > 0 && <TrendingUp className="h-3 w-3" />}
                            {scoreChange < 0 && <TrendingDown className="h-3 w-3" />}
                            {scoreChange === 0 && <Minus className="h-3 w-3" />}
                            {scoreChange > 0 && '+'}
                            {scoreChange}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-muted-foreground">{entry.reason}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {entry.triggeredBy}
                          </Badge>
                          <span>
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
