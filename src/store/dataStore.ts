import { create } from "zustand";
import { User, Content, Message, KnowledgeDocument, PrivacySettings, ChatThread, ThreadStatus, InviteCode, Application, ApplicationStatus, LearningResource } from "../types";

export const MOCK_USERS: User[] = [
  {
    id: "u1",
    name: "Alice Chen",
    email: "alice@example.com",
    role: "EXPERT",
    avatar: "https://picsum.photos/seed/alice/200/200",
    bio: "Senior AI Researcher specializing in LLMs and Computer Vision.",
    skills: ["PyTorch", "Transformers", "Computer Vision", "Python"],
    company: "Tech Innovations Inc.",
    title: "Principal AI Scientist",
    location: "San Francisco, CA",
    socialLinks: { github: "alicechen", linkedin: "alicechen" },
    privacySettings: { emailVisibility: "FULL" },
    whatImDoing: "Researching efficient attention mechanisms for long-context LLMs. Currently working on a new paper.",
    whatICanProvide: "Consulting on model architecture, code reviews for PyTorch implementations, and speaking at tech events.",
    whatImLookingFor: "Collaborators for open-source AI tools and interesting enterprise problems to solve.",
  },
  {
    id: "u2",
    name: "Bob Smith",
    email: "bob@example.com",
    role: "LEARNER",
    avatar: "https://picsum.photos/seed/bob/200/200",
    bio: "Software engineer transitioning into Machine Learning.",
    skills: ["JavaScript", "React", "Python", "Data Analysis"],
    location: "New York, NY",
    socialLinks: { github: "bobsmith" },
    privacySettings: { emailVisibility: "MASKED" },
    whatImDoing: "Taking Andrew Ng's Machine Learning Specialization and building small side projects.",
    whatICanProvide: "Strong frontend skills to build UIs for AI models, eager to learn and contribute.",
    whatImLookingFor: "Mentorship from experienced AI engineers and open-source projects to contribute to.",
  },
  {
    id: "u3",
    name: "Carol Davis",
    email: "carol@example.com",
    role: "ENTERPRISE_LEADER",
    avatar: "https://picsum.photos/seed/carol/200/200",
    bio: "VP of Engineering looking for top AI talent to build next-gen products.",
    company: "Global Solutions Corp",
    title: "VP of Engineering",
    location: "London, UK",
    socialLinks: { linkedin: "caroldavis" },
    privacySettings: { emailVisibility: "HIDDEN" },
    whatImDoing: "Leading the AI transformation at Global Solutions Corp, focusing on internal productivity tools.",
    whatICanProvide: "Funding for promising AI projects, enterprise use cases, and hiring opportunities.",
    whatImLookingFor: "Top-tier AI researchers and engineers to join our growing team.",
    aiStrategy: "Our strategy focuses on leveraging open-source LLMs to automate customer support and internal knowledge retrieval. We are actively building a centralized RAG system and looking for experts to optimize our vector search and embedding models.",
  },
  {
    id: "u4",
    name: "David Lee",
    email: "david@example.com",
    role: "EXPERT",
    avatar: "https://picsum.photos/seed/david/200/200",
    bio: "AI Engineer and Open Source Contributor. Building tools for developers.",
    skills: ["Rust", "C++", "CUDA", "Model Optimization"],
    company: "OpenAI",
    title: "Software Engineer",
    location: "Remote",
    socialLinks: { github: "davidlee", twitter: "davidlee_ai" },
    privacySettings: { emailVisibility: "FULL" },
    whatImDoing: "Optimizing inference engines for edge devices.",
    whatICanProvide: "Deep expertise in CUDA and hardware-level optimization.",
    whatImLookingFor: "Interesting hardware startups to advise.",
  },
  {
    id: "u5",
    name: "Admin User",
    email: "admin@example.com",
    role: "ADMIN",
    avatar: "https://picsum.photos/seed/admin/200/200",
    bio: "System Administrator",
    privacySettings: { emailVisibility: "HIDDEN" },
  },
];

export const MOCK_CONTENTS: Content[] = [
  {
    id: "c1",
    title: "Understanding Attention Mechanisms in Transformers",
    description:
      "A deep dive into how attention works in modern LLMs with code examples.",
    type: "PAPER",
    status: "PUBLISHED",
    authorId: "u1",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    tags: ["LLM", "Transformers", "Deep Learning"],
    likes: 124,
    views: 1540,
    coverImage: "https://picsum.photos/seed/c1/800/400",
    visibility: "ALL",
  },
  {
    id: "c2",
    title: "Optimizing Inference with TensorRT",
    description:
      "Learn how to speed up your model inference using NVIDIA TensorRT.",
    type: "TOOL",
    status: "PUBLISHED",
    authorId: "u4",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    tags: ["Optimization", "CUDA", "TensorRT"],
    likes: 89,
    views: 920,
    coverImage: "https://picsum.photos/seed/c2/800/400",
    visibility: "ALL",
  },
  {
    id: "c3",
    title: "My Journey from Web Dev to AI",
    description:
      "Sharing my learning path and resources for transitioning to AI.",
    type: "PAPER",
    status: "PUBLISHED",
    authorId: "u2",
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    tags: ["Career", "Learning", "Transition"],
    likes: 45,
    views: 300,
    visibility: "ALL",
  },
  {
    id: "c4",
    title: "Draft: New Framework for Agentic Workflows",
    description: "Exploring a new way to build multi-agent systems.",
    type: "PROJECT",
    status: "DRAFT",
    authorId: "u1",
    createdAt: new Date().toISOString(),
    tags: ["Agents", "Framework"],
    likes: 0,
    views: 0,
    visibility: "ALL",
  },
  {
    id: "c5",
    title: "Pending: AI in Healthcare 2024",
    description: "Review of recent advancements in medical AI applications.",
    type: "POLICY",
    status: "PENDING_REVIEW",
    authorId: "u4",
    createdAt: new Date().toISOString(),
    tags: ["Healthcare", "Review"],
    likes: 0,
    views: 0,
    visibility: "ALL",
  },
  {
    id: "c6",
    title: "Global AI Hackathon 2024",
    description: "Join the biggest AI hackathon of the year and build the future.",
    type: "CONTEST",
    status: "PUBLISHED",
    authorId: "u3",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    tags: ["Hackathon", "Competition", "Global"],
    likes: 342,
    views: 5200,
    coverImage: "https://picsum.photos/seed/c6/800/400",
    visibility: "ALL",
  }
];

export const MOCK_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "d1",
    userId: "u1",
    name: "Attention_Is_All_You_Need.pdf",
    size: 1024 * 1024 * 2.5, // 2.5MB
    type: "application/pdf",
    status: "READY",
    uploadedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "d2",
    userId: "u1",
    name: "Project_Proposal_Draft.docx",
    size: 1024 * 500, // 500KB
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    status: "PROCESSING",
    uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  }
];

export const MOCK_THREADS: ChatThread[] = [
  {
    id: "t1",
    participants: [MOCK_USERS[0], MOCK_USERS[2]],
    unreadCount: 1,
    status: "PENDING",
    initiatorId: "u3",
  }
];

export const MOCK_INVITE_CODES: InviteCode[] = [
  {
    id: "inv1",
    code: "AIWORLD-EXPERT-2026",
    status: "UNUSED",
    issuedByAdminId: "u5",
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: "inv2",
    code: "AIWORLD-LEARNER-2026",
    status: "UNUSED",
    issuedByAdminId: "u5",
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: "inv3",
    code: "AIWORLD-ENTERPRISE-2026",
    status: "UNUSED",
    issuedByAdminId: "u5",
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "inv4",
    code: "WELCOME2026",
    status: "UNUSED",
    issuedByAdminId: "u5",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "inv5",
    code: "USED-CODE-DEMO",
    status: "USED",
    issuedByAdminId: "u5",
    boundUserId: "u1",
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
];

export const MOCK_APPLICATIONS: Application[] = [
  {
    id: "app1",
    applicantId: "u2", // Bob (LEARNER) applies to Alice's project
    targetType: "PROJECT",
    targetId: "c4",
    message: "I'm very interested in this multi-agent framework. My experience with React and Python would help build the frontend and integration layer.",
    status: "SUBMITTED",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "app2",
    applicantId: "u2", // Bob applies to enterprise need
    targetType: "ENTERPRISE_NEED",
    targetId: "c6",
    message: "I'd love to contribute to this initiative. I have experience with data analysis and am actively learning ML.",
    status: "ACCEPTED",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export const MOCK_LEARNING_RESOURCES: LearningResource[] = [
  {
    id: "lr1",
    title: "Machine Learning Specialization",
    description: "Andrew Ng's comprehensive course covering supervised learning, unsupervised learning, and best practices.",
    url: "https://www.coursera.org/specializations/machine-learning-introduction",
    type: "COURSE",
    source: "Coursera",
    tags: ["Machine Learning", "Fundamentals"],
    difficulty: "BEGINNER",
  },
  {
    id: "lr2",
    title: "Practical Deep Learning for Coders",
    description: "Fast.ai's top-down approach to deep learning with hands-on projects.",
    url: "https://course.fast.ai/",
    type: "COURSE",
    source: "fast.ai",
    tags: ["Deep Learning", "PyTorch"],
    difficulty: "INTERMEDIATE",
  },
  {
    id: "lr3",
    title: "Transformer from Scratch",
    description: "Step-by-step tutorial to implement transformer architecture in PyTorch.",
    url: "https://github.com/example/transformer-tutorial",
    type: "TUTORIAL",
    source: "GitHub",
    tags: ["Transformers", "NLP", "PyTorch"],
    difficulty: "ADVANCED",
  },
  {
    id: "lr4",
    title: "LangChain & RAG Applications",
    description: "Build production-ready RAG applications with LangChain and vector databases.",
    url: "https://www.bilibili.com/video/example",
    type: "VIDEO",
    source: "Bilibili",
    tags: ["RAG", "LangChain", "LLM"],
    difficulty: "INTERMEDIATE",
  },
  {
    id: "lr5",
    title: "AI Engineer Learning Path",
    description: "A curated path from fundamentals to production-ready AI systems.",
    url: "#",
    type: "PATH",
    source: "AI-World",
    tags: ["Career", "Learning Path"],
    difficulty: "BEGINNER",
  },
];

interface DataState {
  users: User[];
  contents: Content[];
  messages: Message[];
  documents: KnowledgeDocument[];
  chatThreads: ChatThread[];
  inviteCodes: InviteCode[];
  applications: Application[];
  learningResources: LearningResource[];
  addContent: (content: Content) => void;
  updateContent: (id: string, updates: Partial<Content>) => void;
  updateContentStatus: (id: string, status: Content["status"], rejectReason?: string) => void;
  sendMessage: (msg: Message) => void;
  addDocument: (doc: KnowledgeDocument) => void;
  deleteDocument: (id: string) => void;
  updatePrivacySettings: (userId: string, settings: PrivacySettings) => void;
  updateUserProfile: (userId: string, updates: Partial<User>) => void;
  updateThreadStatus: (threadId: string, status: ThreadStatus) => void;
  createThread: (thread: ChatThread) => void;
  verifyInviteCode: (code: string) => InviteCode | null;
  consumeInviteCode: (code: string, userId: string) => void;
  submitApplication: (app: Application) => void;
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  getApplicationsForContent: (contentId: string) => Application[];
  getApplicationsByUser: (userId: string) => Application[];
  blockUser: (userId: string, blockedId: string) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  users: MOCK_USERS,
  contents: MOCK_CONTENTS,
  messages: [
    {
      id: "m1",
      senderId: "u3",
      receiverId: "u1",
      content:
        "Hi Alice, I loved your article on Transformers. We are looking for experts to consult on a new project. Would you be interested?",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      read: false,
    },
  ],
  documents: MOCK_DOCUMENTS,
  chatThreads: MOCK_THREADS,
  inviteCodes: MOCK_INVITE_CODES,
  applications: MOCK_APPLICATIONS,
  learningResources: MOCK_LEARNING_RESOURCES,
  addContent: (content) =>
    set((state) => ({ contents: [content, ...state.contents] })),
  updateContent: (id, updates) =>
    set((state) => ({
      contents: state.contents.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  updateContentStatus: (id, status, rejectReason) =>
    set((state) => ({
      contents: state.contents.map((c) => (c.id === id ? { ...c, status, ...(rejectReason ? { rejectReason } : {}) } : c)),
    })),
  sendMessage: (msg) =>
    set((state) => {
      // Also update the thread's last message
      const threadId = [msg.senderId, msg.receiverId].sort().join("-");
      const existingThread = state.chatThreads.find(t => t.id === threadId);
      
      let newThreads = [...state.chatThreads];
      if (existingThread) {
        newThreads = newThreads.map(t => t.id === threadId ? { ...t, lastMessage: msg } : t);
      } else {
        const sender = state.users.find(u => u.id === msg.senderId);
        const receiver = state.users.find(u => u.id === msg.receiverId);
        if (sender && receiver) {
          newThreads.push({
            id: threadId,
            participants: [sender, receiver],
            lastMessage: msg,
            unreadCount: 1,
            status: "PENDING",
            initiatorId: msg.senderId,
          });
        }
      }
      return { messages: [...state.messages, msg], chatThreads: newThreads };
    }),
  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
  deleteDocument: (id) =>
    set((state) => ({ documents: state.documents.filter((d) => d.id !== id) })),
  updatePrivacySettings: (userId, settings) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, privacySettings: settings } : u
      ),
    })),
  updateUserProfile: (userId, updates) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, ...updates } : u
      ),
    })),
  updateThreadStatus: (threadId, status) =>
    set((state) => ({
      chatThreads: state.chatThreads.map((t) =>
        t.id === threadId ? { ...t, status } : t
      ),
    })),
  createThread: (thread) =>
    set((state) => ({ chatThreads: [thread, ...state.chatThreads] })),
  verifyInviteCode: (code: string) => {
    const found = get().inviteCodes.find(
      (ic) => ic.code.toUpperCase() === code.toUpperCase() && ic.status === "UNUSED"
    );
    return found || null;
  },
  consumeInviteCode: (code: string, userId: string) =>
    set((state) => ({
      inviteCodes: state.inviteCodes.map((ic) =>
        ic.code.toUpperCase() === code.toUpperCase()
          ? { ...ic, status: "USED" as const, boundUserId: userId }
          : ic
      ),
    })),
  submitApplication: (app) =>
    set((state) => ({ applications: [app, ...state.applications] })),
  updateApplicationStatus: (id, status) =>
    set((state) => ({
      applications: state.applications.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    })),
  getApplicationsForContent: (contentId) => {
    return get().applications.filter((a) => a.targetId === contentId);
  },
  getApplicationsByUser: (userId) => {
    return get().applications.filter((a) => a.applicantId === userId);
  },
  blockUser: (userId, blockedId) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId
          ? { ...u, blockedUsers: [...(u.blockedUsers || []), blockedId] }
          : u
      ),
    })),
}));
