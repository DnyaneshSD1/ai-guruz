// Shapes returned by the AI Guruz API (see backend/README.md for the endpoint list).

export type Role = "STUDENT" | "RESEARCHER" | "TEACHER" | "LIBRARIAN" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
  user: User;
}

export interface Tenant {
  id: string;
  name: string;
  joinCode: string | null;
  personal: boolean;
  members: number;
}

export interface Doc {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  filename: string;
  contentType: string;
  size: number;
  visibility: "PRIVATE" | "SHARED";
  status: "PROCESSING" | "READY" | "FAILED";
  error: string | null;
  charCount: number;
  createdAt: string;
}

export type AnalysisType = "SUMMARY" | "MIND_MAP" | "DEEP_ANALYSIS" | "EXAM_PREP";

export interface MindNode {
  label: string;
  children?: MindNode[];
}

export interface Analysis {
  id: string;
  documentId: string;
  type: AnalysisType;
  status: "PENDING" | "READY" | "FAILED";
  // Shape depends on type; see the renderers in AnalysisView.
  result: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  confidence: number;
  provider: string | null;
  fallbackUsed: boolean;
  sourceTruncated: boolean;
  durationMs: number;
  error: string | null;
}

export interface Module {
  id: string;
  title: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  kind: "CORE" | "REMEDIAL" | "LATERAL";
  objectives: string[];
  concepts: string[];
  estimatedMinutes: number;
  status: "LOCKED" | "AVAILABLE" | "COMPLETED";
  content: string | null;
  contentProvider: string | null;
  score: number | null;
}

export interface Curriculum {
  id: string;
  userId: string;
  userName: string;
  topic: string;
  goal: string | null;
  status: "GENERATING" | "READY" | "FAILED";
  summary: string | null;
  sources: { title: string; url: string; snippet: string }[];
  modules: Module[];
  provider: string | null;
  fallbackUsed: boolean;
  generationMs: number;
  error: string | null;
  createdAt: string;
}

export interface Question {
  id: string;
  type: "MCQ" | "SHORT";
  prompt: string;
  options: string[];
  concept: string;
  correctIndex: number | null;
  answerGuide: string | null;
  explanation: string | null;
}

export interface Assessment {
  id: string;
  curriculumId: string;
  moduleId: string;
  moduleTitle: string;
  questions: Question[];
  status: "OPEN" | "SUBMITTED";
  answers: { questionId: string; selectedIndex: number | null; text: string | null }[];
  results: { questionId: string; score: number; feedback: string | null }[];
  score: number | null;
  conceptScores: { concept: string; score: number }[];
  decision: "ADVANCE" | "REMEDIAL" | "LATERAL" | null;
  nextModuleId: string | null;
  message: string | null;
  fallbackUsed: boolean;
}

export interface GraphNode {
  id: string;
  type: "TOPIC" | "MODULE" | "CONCEPT";
  label: string;
  mastery: number | null;
  attempts: number | null;
  status: string | null;
  kind: string | null;
}

export interface Graph {
  curriculumId: string;
  topic: string;
  nodes: GraphNode[];
  edges: { from: string; to: string; type: string }[];
}

export interface Progress {
  curriculumId: string;
  topic: string;
  totalModules: number;
  completedModules: number;
  averageScore: number | null;
  averageMastery: number | null;
  remedialModules: number;
  lateralModules: number;
  nextModuleId: string | null;
  nextModuleTitle: string | null;
}

export interface Recommendation {
  type: "CONTINUE" | "REVIEW" | "EXPLORE" | "START";
  title: string;
  detail: string;
  curriculumId: string | null;
  moduleId: string | null;
  topic: string | null;
}

export interface Timing {
  averageMs: number | null;
  targetMs: number;
  withinTargetShare: number | null;
  samples: number;
}

export interface Dashboard {
  scope: "me" | "tenant";
  days: number;
  totals: Record<string, number>;
  averageScore: number | null;
  decisions: Record<"ADVANCE" | "LATERAL" | "REMEDIAL", number>;
  pathDivergence: number | null;
  averageConfidence: number | null;
  analysisTiming: Timing;
  curriculumTiming: Timing;
  activity: { date: string; count: number }[];
  scoreTrend: { date: string; averageScore: number }[];
  scoreDistribution: { label: string; count: number }[];
  analysesByType: Record<"SUMMARY" | "MIND_MAP" | "DEEP_ANALYSIS" | "EXAM_PREP", number>;
  learners: { userId: string; name: string; assessments: number; averageScore: number | null; lastActive: string }[];
}

export interface AuditEvent {
  id: string;
  userName: string;
  type: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  service: string;
}

export interface AuditPage {
  items: AuditEvent[];
  page: number;
  size: number;
  total: number;
}
