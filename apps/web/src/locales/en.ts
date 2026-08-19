export const en = {
  common: {
    appName: 'Timeline',
    cancel: 'Cancel',
    create: 'Create',
    close: 'Close',
    loading: 'Loading…',
    retry: 'Retry',
    logout: 'Log out',
    present: 'Present',
    language: 'Language',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  auth: {
    login: {
      title: 'Welcome back',
      email: 'Email',
      password: 'Password',
      submit: 'Sign in',
      noAccount: "Don't have an account?",
      registerLink: 'Create one',
      forgotLink: 'Forgot your password?',
    },
    register: {
      title: 'Create your account',
      email: 'Email',
      username: 'Username',
      usernameHint: 'Lowercase letters, digits and underscores',
      displayName: 'Display name',
      password: 'Password',
      submit: 'Create account',
      haveAccount: 'Already have an account?',
      loginLink: 'Sign in',
    },
    verify: {
      title: 'Check your email',
      description: 'We sent a 6-digit code to {{email}}.',
      code: 'Verification code',
      submit: 'Verify',
      mockHint: 'Local mode: any 6-digit code works until real authentication arrives.',
    },
    forgot: {
      title: 'Reset your password',
      description: "Enter your email and we'll send you a reset link.",
      email: 'Email',
      submit: 'Send reset link',
      sent: 'If that account exists, we sent a link to {{email}}.',
      backToLogin: 'Back to sign in',
    },
    errors: {
      invalidEmail: 'Enter a valid email address',
      passwordMin: 'Password must be at least 8 characters',
      usernameInvalid: '3–30 characters: lowercase letters, digits, underscores',
      displayNameRequired: 'Enter a name',
      codeInvalid: 'Enter the 6-digit code',
    },
  },
  dashboard: {
    greeting: {
      morning: 'Good morning.',
      afternoon: 'Good afternoon.',
      evening: 'Good evening.',
    },
    yourTimelines: 'Your timelines',
    newTimeline: 'New Timeline',
    empty: {
      title: 'No timelines yet',
      description: 'Create your first timeline and start organizing your history.',
    },
  },
  timeline: {
    form: {
      dialogTitle: 'New Timeline',
      title: 'Title',
      description: 'Description',
      start: 'Start',
      end: 'End',
      ongoing: 'Ongoing',
      unit: 'Time unit',
      rulerVisible: 'Show ruler',
      visibility: 'Visibility',
      visibilityPrivate: 'Private',
      visibilityHint: 'Sharing options arrive in a later phase.',
      errors: {
        titleRequired: 'Enter a title',
        startRequired: 'Choose a start date',
        endInvalid: 'End cannot be before start (or set the timeline as ongoing)',
      },
    },
    units: {
      DAYS: 'Days',
      MONTHS: 'Months',
      QUARTERS: 'Quarters',
      YEARS: 'Years',
    },
    canvasPlaceholder: 'The timeline canvas arrives in Phase 2.',
    backToDashboard: 'Back to dashboard',
    notFound: 'This timeline does not exist.',
  },
  canvas: {
    label: 'Timeline canvas',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    ruler: 'Ruler',
    empty: 'No milestones or stages yet.',
  },
  milestone: {
    appearsIn_one: 'Appears in {{count}} timeline',
    appearsIn_other: 'Appears in {{count}} timelines',
  },
  dates: {
    precisionLabel: 'Precision',
    precision: {
      DAY: 'Day',
      MONTH: 'Month',
      QUARTER: 'Quarter',
      YEAR: 'Year',
      APPROXIMATE: 'Approximate',
    },
    day: 'Date',
    month: 'Month',
    quarter: 'Quarter',
    year: 'Year',
  },
  notFound: {
    title: 'Page not found',
    back: 'Go to dashboard',
  },
} as const;

/** Same key structure as the English bundle, values widened to string. */
type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};
export type TranslationShape = DeepStringRecord<typeof en>;
