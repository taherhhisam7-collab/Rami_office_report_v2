import { google } from "googleapis";
import { parseServiceAccountJson } from "./serviceAccount";
import { and, eq, gte, lt } from "drizzle-orm";
import { receipts, type InsertReceipt } from "../drizzle/schema";
import { getDb, bulkInsertReceipts } from "./db";


// ===== خريطة الشهور العربية =====
const ARABIC_MONTHS: Record<number, string> = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};


export const ARABIC_MONTHS_MAP = ARABIC_MONTHS;


/** استخراج اسم الشهر الحالي بالعربية */
export function getCurrentArabicMonth(): string {
  const month = new Date().getMonth() + 1; // 1-12
  return ARABIC_MONTHS[month] ?? "يناير";
}


/** استخراج اسم الشهر بالعربية من timestamp */
export function getArabicMonthFromTs(ts: number): string {
  const month = new Date(ts).getMonth() + 1;
  return ARABIC_MONTHS[month] ?? "يناير";
}


/** تحويل اسم الشهر العربي إلى رقمه (1-12) */
