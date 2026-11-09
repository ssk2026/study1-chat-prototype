import { json } from "../lib/http.js";

export async function GET() {
  return json({
    consentVersion: process.env.CONSENT_VERSION || "consent-draft-v1",
    postSurveyUrl: process.env.POST_SURVEY_URL || "",
  });
}
