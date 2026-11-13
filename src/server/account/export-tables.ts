// Les tables de « Télécharger mes données » (Loi 25) : chaque table liée à un
// membre est ici ou dans EXCLUDED_MODELS avec sa raison (un test le vérifie à
// partir du schéma). Requêtes SQL fixes (aucun nom ne vient du navigateur),
// `$1` : l'userId. Sans connexion à la base : le test le lit tel quel.

/** Au plus, par table (les mesures d'utilisation peuvent être nombreuses). */
const MAX_ROWS = 20_000;

/** Les lignes d'une table qui appartiennent à la personne. */
const own = (table: string, column = "user_id") =>
  `SELECT * FROM "${table}" WHERE "${column}" = $1::uuid LIMIT ${MAX_ROWS}`;

/** Les lignes d'une table rattachées aux lignes de la personne dans une autre. */
const through = (table: string, column: string, parent: string) =>
  `SELECT * FROM "${table}" WHERE "${column}" IN (SELECT id FROM "${parent}" WHERE user_id = $1::uuid) LIMIT ${MAX_ROWS}`;

/** Les tables exportées : la clé du fichier, le modèle Prisma et sa requête. */
export const EXPORTED: { key: string; model: string; sql: string }[] = [
  { key: "settings", model: "UserSettings", sql: own("user_settings") },
  { key: "goals", model: "Goal", sql: own("goals") },
  {
    key: "goalMilestones",
    model: "GoalMilestone",
    sql: through("goal_milestones", "goal_id", "goals"),
  },
  { key: "tasks", model: "Task", sql: own("tasks") },
  { key: "habits", model: "Habit", sql: own("habits") },
  {
    key: "habitCompletions",
    model: "HabitCompletion",
    sql: through("habit_completions", "habit_id", "habits"),
  },
  {
    key: "pillarAssessments",
    model: "PillarAssessment",
    sql: own("pillar_assessments"),
  },
  {
    key: "calendarEvents",
    model: "CalendarEvent",
    sql: own("calendar_events"),
  },
  {
    key: "developmentPlans",
    model: "DevelopmentPlan",
    sql: own("development_plans"),
  },
  { key: "planItemLogs", model: "PlanItemLog", sql: own("plan_item_logs") },
  {
    key: "workoutSessions",
    model: "WorkoutSession",
    sql: own("workout_sessions"),
  },
  { key: "measurements", model: "Measurement", sql: own("measurements") },
  { key: "checkIns", model: "DailyCheckIn", sql: own("daily_check_ins") },
  { key: "journalEntries", model: "JournalEntry", sql: own("journal_entries") },
  { key: "journalMedia", model: "JournalMedia", sql: own("journal_media") },
  {
    key: "budgetAccounts",
    model: "BudgetAccount",
    sql: own("budget_accounts"),
  },
  { key: "budgetEntries", model: "BudgetEntry", sql: own("budget_entries") },
  {
    key: "budgetRecurring",
    model: "BudgetRecurring",
    sql: own("budget_recurring"),
  },
  { key: "budgetSkips", model: "BudgetSkip", sql: own("budget_skips") },
  { key: "budgetGoals", model: "BudgetGoal", sql: own("budget_goals") },
  {
    key: "budgetCategories",
    model: "BudgetCategorySetting",
    sql: own("budget_categories"),
  },
  { key: "budgetPlans", model: "BudgetPlan", sql: own("budget_plans") },
  { key: "xpEvents", model: "XpEvent", sql: own("xp_events") },
  {
    key: "rankedEvaluations",
    model: "RankedEvaluation",
    sql: own("ranked_evaluations"),
  },
  { key: "aiRequests", model: "AiRequest", sql: own("ai_requests") },
  {
    key: "coachConversations",
    model: "CoachConversation",
    sql: own("coach_conversations"),
  },
  {
    key: "coachMessages",
    model: "CoachMessage",
    sql: through("coach_messages", "conversation_id", "coach_conversations"),
  },
  { key: "coachActions", model: "CoachAction", sql: own("coach_actions") },
  { key: "posts", model: "Post", sql: own("posts") },
  {
    key: "postMedia",
    model: "PostMedia",
    sql: through("post_media", "post_id", "posts"),
  },
  { key: "postComments", model: "PostComment", sql: own("post_comments") },
  { key: "postReactions", model: "PostReaction", sql: own("post_reactions") },
  { key: "postSaves", model: "PostSave", sql: own("post_saves") },
  { key: "videoViews", model: "PostVideoView", sql: own("post_video_views") },
  { key: "stories", model: "Story", sql: own("stories") },
  {
    key: "storyViews",
    model: "StoryView",
    sql: own("story_views", "viewer_id"),
  },
  {
    key: "storyPollVotes",
    model: "StoryPollVote",
    sql: own("story_poll_votes", "voter_id"),
  },
  {
    key: "storyAnswers",
    model: "StoryAnswer",
    sql: own("story_answers", "author_id"),
  },
  { key: "groupsOwned", model: "Group", sql: own("groups", "owner_id") },
  {
    key: "groupMemberships",
    model: "GroupMember",
    sql: own("group_members"),
  },
  {
    key: "conversationsStarted",
    model: "Conversation",
    sql: own("conversations", "created_by_id"),
  },
  {
    key: "conversationMemberships",
    model: "ConversationMember",
    sql: own("conversation_members"),
  },
  {
    key: "messagesSent",
    model: "Message",
    sql: own("messages", "sender_id"),
  },
  {
    key: "messageReactions",
    model: "MessageReaction",
    sql: own("message_reactions"),
  },
  { key: "pactsProposed", model: "Pact", sql: own("pacts", "proposed_by_id") },
  { key: "pactMemberships", model: "PactMember", sql: own("pact_members") },
  { key: "following", model: "Follow", sql: own("follows", "follower_id") },
  {
    key: "contacts",
    model: "Contact",
    sql: `SELECT * FROM "contacts" WHERE "requester_id" = $1::uuid OR "addressee_id" = $1::uuid LIMIT ${MAX_ROWS}`,
  },
  { key: "blocks", model: "UserBlock", sql: own("user_blocks", "blocker_id") },
  {
    key: "reportsMade",
    model: "ContentReport",
    sql: own("content_reports", "reporter_id"),
  },
  { key: "listings", model: "Listing", sql: own("listings", "seller_id") },
  {
    key: "listingFavorites",
    model: "ListingFavorite",
    sql: own("listing_favorites"),
  },
  { key: "page", model: "Page", sql: own("pages", "owner_id") },
  {
    key: "pagesFollowed",
    model: "PageFollow",
    sql: own("page_follows", "follower_id"),
  },
  {
    key: "prosFollowingMe",
    model: "PageClient",
    sql: own("page_clients", "client_id"),
  },
  {
    key: "planProposals",
    model: "PlanProposal",
    sql: own("plan_proposals", "client_id"),
  },
  {
    key: "eventsHosted",
    model: "CommunityEvent",
    sql: own("community_events", "host_id"),
  },
  {
    key: "eventAttendances",
    model: "CommunityEventAttendee",
    sql: own("community_event_attendees"),
  },
  {
    key: "eventComments",
    model: "CommunityEventComment",
    sql: own("community_event_comments"),
  },
  { key: "notifications", model: "Notification", sql: own("notifications") },
  { key: "feedback", model: "Feedback", sql: own("feedback") },
  {
    key: "usageEvents",
    model: "AnalyticsEvent",
    sql: own("analytics_events"),
  },
];

/** Les tables liées à un membre qui ne sont pas exportées, et pourquoi. */
export const EXCLUDED_MODELS: Record<string, string> = {
  MediaUpload: "autorisations d'envoi temporaires, sans contenu",
  PushSubscription: "clés techniques de l'appareil pour les notifications",
  ClientNote:
    "notes d'un professionnel sur son client : elles font partie du dossier du professionnel",
  MusicTrack: "catalogue de musique ajouté par l'équipe",
  LibraryItem: "fiches du catalogue rédigées par l'équipe",
  AdminAuditEntry: "journal de sécurité des accès de l'équipe",
  AppError: "erreurs techniques, sans renseignement personnel",
};
