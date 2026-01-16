import type {
  ChangePasswordBody,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  SafeUser,
  TotpCodeBody,
} from "@api/modules/auth/auth.model";

import { api } from "$lib/api";
import { ApiError, createApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export type User = SafeUser;

export type RegisterInput = RegisterBody;

export type LoginInput = LoginBody;

export interface LoginResponse {
  message: string;
  user?: User;
  requires2fa?: boolean;
}

export type Verify2faInput = TotpCodeBody;

export type ForgotPasswordInput = ForgotPasswordBody;

export type ResetPasswordInput = ResetPasswordBody;

export type ChangePasswordInput = ChangePasswordBody;

export interface Enable2faResponse {
  message: string;
  qrCodeUrl: string;
  secret: string;
}

export type Verify2faSetupInput = TotpCodeBody;

/**
 * Query to get the current authenticated user.
 */
export function createMeQuery() {
  return createQuery<User | null, ApiError>(() => ({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const response = await api.api.auth.me.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data.user as User;
    },
    retry: false,
  }));
}

/**
 * Mutation to register a new user.
 */
export function createRegisterMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, RegisterInput>(() => ({
    mutationFn: async (input: RegisterInput) => {
      const response = await api.api.auth.register.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  }));
}

/**
 * Mutation to log in with email/password.
 */
export function createLoginMutation() {
  const queryClient = useQueryClient();

  return createMutation<LoginResponse, ApiError, LoginInput>(() => ({
    mutationFn: async (input: LoginInput) => {
      const response = await api.api.auth.login.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as LoginResponse;
    },
    onSuccess: (data: LoginResponse) => {
      if (!data.requires2fa) {
        queryClient.invalidateQueries({ queryKey: authKeys.me() });
      }
    },
  }));
}

/**
 * Mutation to complete 2FA login.
 */
export function createVerify2faLoginMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, Verify2faInput>(() => ({
    mutationFn: async (input: Verify2faInput) => {
      const response = await api.api.auth["2fa"].login.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  }));
}

/**
 * Mutation to log out.
 */
export function createLogoutMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.auth.logout.post(undefined, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      queryClient.clear();
    },
  }));
}

/**
 * Mutation to log out from all devices.
 */
export function createLogoutAllMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.auth["logout-all"].post(undefined, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      queryClient.clear();
    },
  }));
}

/**
 * Mutation to verify email.
 */
export function createVerifyEmailMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, string>(() => ({
    mutationFn: async (token: string) => {
      const response = await api.api.auth["verify-email"].post(
        { token },
        { fetch: { credentials: "include" } }
      );

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  }));
}

/**
 * Mutation to resend verification email.
 */
export function createResendVerificationMutation() {
  return createMutation<unknown, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.auth["resend-verification"].post(
        undefined,
        {
          fetch: { credentials: "include" },
        }
      );

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
  }));
}

/**
 * Mutation to request password reset.
 */
export function createForgotPasswordMutation() {
  return createMutation<unknown, ApiError, ForgotPasswordInput>(() => ({
    mutationFn: async (input: ForgotPasswordInput) => {
      const response = await api.api.auth["forgot-password"].post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
  }));
}

/**
 * Mutation to reset password with token.
 */
export function createResetPasswordMutation() {
  return createMutation<unknown, ApiError, ResetPasswordInput>(() => ({
    mutationFn: async (input: ResetPasswordInput) => {
      const response = await api.api.auth["reset-password"].post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
  }));
}

/**
 * Mutation to change password (for logged-in users).
 */
export function createChangePasswordMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, ChangePasswordInput>(() => ({
    mutationFn: async (input: ChangePasswordInput) => {
      const response = await api.api.auth["change-password"].post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      queryClient.clear();
    },
  }));
}

/**
 * Mutation to enable 2FA (step 1 - get QR code).
 */
export function createEnable2faMutation() {
  return createMutation<Enable2faResponse, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.auth["2fa"].enable.post(undefined, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as Enable2faResponse;
    },
  }));
}

/**
 * Mutation to verify and activate 2FA (step 2).
 */
export function createVerify2faMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, Verify2faSetupInput>(() => ({
    mutationFn: async (input: Verify2faSetupInput) => {
      const response = await api.api.auth["2fa"].verify.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  }));
}

/**
 * Mutation to disable 2FA.
 */
export function createDisable2faMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, Verify2faSetupInput>(() => ({
    mutationFn: async (input: Verify2faSetupInput) => {
      const response = await api.api.auth["2fa"].disable.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  }));
}

/**
 * Redirect to 42 OAuth login.
 */
export function redirectTo42OAuth() {
  window.location.href = `${window.location.origin}/api/auth/42`;
}

/**
 * Redirect to link 42 account (for logged-in users).
 */
export function redirectToLink42() {
  window.location.href = `${window.location.origin}/api/auth/42/link`;
}

export interface Unlink42Input {
  password: string;
}

/**
 * Mutation to unlink 42 account.
 */
export function createUnlink42Mutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, Unlink42Input>(() => ({
    mutationFn: async (input: Unlink42Input) => {
      const response = await api.api.auth["42"].unlink.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  }));
}
