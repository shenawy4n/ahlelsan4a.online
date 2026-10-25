/**
 * Single source of truth for homepage and directory service shortcuts:
 * - available_now: متاح الآن
 * - emergency_now: طوارئ ٢٤ ساعة
 * - delivery: توصيل للمنازل
 */

export type ShortcutId = "available_now" | "emergency_now" | "delivery";

export const KNOWN_SHORTCUT_IDS: readonly ShortcutId[] = [
  "available_now",
  "emergency_now",
  "delivery",
] as const;

export const DEFAULT_SHORTCUTS_ORDER: readonly ShortcutId[] = [
  "available_now",
  "emergency_now",
  "delivery",
] as const;

export const SHORTCUT_SETTINGS_KEY = "service_shortcuts_order";
export const LEGACY_SHORTCUT_SETTINGS_KEY = "homepage_shortcuts_order";

export interface ShortcutDefinition {
  id: ShortcutId;
  label: string;
  badgeLabel: string;
  description: string;
}

export const SHORTCUT_DEFINITIONS: Record<ShortcutId, ShortcutDefinition> = {
  available_now: {
    id: "available_now",
    label: "متاح الآن",
    badgeLabel: "متاح الآن فقط",
    description: "تصفية الصنايعية وأصحاب المهن المتاحين للعمل في الوقت الحالي",
  },
  emergency_now: {
    id: "emergency_now",
    label: "طوارئ ٢٤ ساعة",
    badgeLabel: "خدمة طوارئ ٢٤ ساعة",
    description: "عرض الصنايعية والورش الجاهزة لحالات الطوارئ طوال اليوم",
  },
  delivery: {
    id: "delivery",
    label: "توصيل للمنازل",
    badgeLabel: "توصيل للمنازل",
    description: "عرض مقدمي الخدمات الذين يوفرون إمكانية توصيل للمنازل",
  },
};

/**
 * Resolves the display order of shortcuts safely:
 * - Uses saved order if valid
 * - Gracefully appends any missing known shortcut identifiers
 * - Filters out invalid/duplicate identifiers
 * - Falls back to DEFAULT_SHORTCUTS_ORDER on missing/corrupted input
 */
export function resolveShortcutsOrder(rawSetting?: string | null): ShortcutId[] {
  if (!rawSetting || typeof rawSetting !== "string") {
    return [...DEFAULT_SHORTCUTS_ORDER];
  }

  let candidates: unknown[] = [];
  try {
    const trimmed = rawSetting.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      candidates = JSON.parse(trimmed);
    } else if (trimmed.includes(",")) {
      candidates = trimmed.split(",").map((s) => s.trim());
    } else if (KNOWN_SHORTCUT_IDS.includes(trimmed as ShortcutId)) {
      candidates = [trimmed];
    }
  } catch {
    return [...DEFAULT_SHORTCUTS_ORDER];
  }

  if (!Array.isArray(candidates)) {
    return [...DEFAULT_SHORTCUTS_ORDER];
  }

  const validOrder: ShortcutId[] = [];
  for (const item of candidates) {
    if (
      typeof item === "string" &&
      KNOWN_SHORTCUT_IDS.includes(item as ShortcutId) &&
      !validOrder.includes(item as ShortcutId)
    ) {
      validOrder.push(item as ShortcutId);
    }
  }

  // Gracefully append any missing known shortcuts in default order
  for (const defaultId of DEFAULT_SHORTCUTS_ORDER) {
    if (!validOrder.includes(defaultId)) {
      validOrder.push(defaultId);
    }
  }

  return validOrder;
}

/**
 * Validates and normalizes order input for save operations.
 */
export function validateShortcutsOrder(order: unknown): {
  valid: boolean;
  order: ShortcutId[];
  error?: string;
} {
  if (!Array.isArray(order)) {
    return {
      valid: false,
      order: [...DEFAULT_SHORTCUTS_ORDER],
      error: "يجب أن يكون ترتيب الاختصارات مصفوفة صالحة",
    };
  }

  // Check for unknown items
  const hasUnknown = order.some((id) => !KNOWN_SHORTCUT_IDS.includes(id as ShortcutId));
  if (hasUnknown) {
    return {
      valid: false,
      order: [...DEFAULT_SHORTCUTS_ORDER],
      error: "يحتوي الترتيب على عناصر غير صالحة",
    };
  }

  // Check duplicates
  const set = new Set(order);
  if (set.size !== order.length) {
    return {
      valid: false,
      order: [...DEFAULT_SHORTCUTS_ORDER],
      error: "يحتوي الترتيب على عناصر مكررة",
    };
  }

  // Normalize order (appends any missing known identifiers)
  const normalized = resolveShortcutsOrder(JSON.stringify(order));
  return { valid: true, order: normalized };
}
