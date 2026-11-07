"use client";

import { useEffect, useState } from "react";
import { getJson, postJson } from "./fetcher";
import type { FullReview, ProfileActivity } from "./types";

const CACHE_MS = 12 * 60 * 60 * 1000;
const POLL_MS = 5000;
const MAX_POLLS = 36;

type Poll = {
  posts: { ready: boolean; posts?: { date: string | null; hasImage: boolean }[] };
  reviews: { ready: boolean; sample?: number; unanswered?: number; recent?: FullReview[] };
};

function readCache(placeId: string): ProfileActivity | null {
  try {
    const v = JSON.parse(localStorage.getItem(`activity:${placeId}`) ?? "null") as ProfileActivity | null;
    // Consultas guardadas antes de existir a lista das mais recentes são refeitas.
    const complete = v && (v.reviews === null || Array.isArray(v.reviews.recent));
    return v && complete && Date.now() - Date.parse(v.checkedAt) < CACHE_MS ? v : null;
  } catch {
    return null;
  }
}

function writeCache(placeId: string, v: ProfileActivity) {
  try {
    localStorage.setItem(`activity:${placeId}`, JSON.stringify(v));
  } catch {
    /* armazenamento indisponível */
  }
}

const latest = (dates: (string | null)[]) =>
  dates.filter((d): d is string => !!d).sort().at(-1) ?? null;

/**
 * Postagens e respostas recentes do perfil. Consulta a DataForSEO em segundo plano depois que a
 * análise abre e guarda o resultado no navegador por 12 horas.
 */
export function useProfileActivity(placeId: string, enabled: boolean) {
  const [activity, setActivity] = useState<ProfileActivity | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const cached = readCache(placeId);
    if (cached) {
      setActivity(cached);
      return;
    }
    let stop = false;
    setLoading(true);
    (async () => {
      try {
        const { postsTask, reviewsTask } = await postJson<{ postsTask: string; reviewsTask: string }>("/api/activity", { placeId });
        for (let i = 0; i < MAX_POLLS && !stop; i++) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          const p = await getJson<Poll>(`/api/activity?posts=${postsTask}&reviews=${reviewsTask}`);
          if (!p.posts.ready || !p.reviews.ready) continue;
          const posts = p.posts.posts ?? [];
          const result: ProfileActivity = {
            checkedAt: new Date().toISOString(),
            posts: {
              count: posts.length,
              lastDate: latest(posts.map((x) => x.date)),
              lastImageDate: latest(posts.filter((x) => x.hasImage).map((x) => x.date)),
            },
            reviews: p.reviews.sample
              ? { sample: p.reviews.sample, unanswered: p.reviews.unanswered ?? 0, recent: p.reviews.recent ?? [] }
              : null,
          };
          writeCache(placeId, result);
          if (!stop) setActivity(result);
          break;
        }
      } catch {
        /* sem atividade: os itens continuam na verificação manual */
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [placeId, enabled]);

  return { activity, loading };
}
