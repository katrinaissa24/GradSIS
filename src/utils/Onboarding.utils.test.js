import { describe, it, expect } from "vitest";
import {
  hasCompletedOnboarding,
  isProfileComplete,
} from "./OnBoarding.utils";

describe("isProfileComplete(profile)", () => {
  it("Don't forget null: returns false for null/undefined", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it("Test edge cases: returns false when any required field is empty", () => {
    expect(
      isProfileComplete({
        academicStanding: "",
        major: "m1",
        startingTerm: "t1",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: "",
        startingTerm: "t1",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: "m1",
        startingTerm: "",
      }),
    ).toBe(false);
  });

  it("Test edge cases: treats white sspace only values as empty", () => {
    expect(
      isProfileComplete({
        academicStanding: "   ",
        major: "m1",
        startingTerm: "t1",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: "   ",
        startingTerm: "t1",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: "m1",
        startingTerm: "   ",
      }),
    ).toBe(false);
  });

  it("null: returns false when fields are null/undefined", () => {
    expect(
      isProfileComplete({
        academicStanding: null,
        major: "m1",
        startingTerm: "t1",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: undefined,
        startingTerm: "t1",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: "m1",
        startingTerm: null,
      }),
    ).toBe(false);
  });

  it("One is different: returns true for a single valid profile object", () => {
    expect(
      isProfileComplete({
        academicStanding: "freshman",
        major: "m1",
        startingTerm: "t1",
      }),
    ).toBe(true);
  });

  it("Repeat yourself: same input gives same output every time", () => {
    const profile = {
      academicStanding: "regular",
      major: "m2",
      startingTerm: "t2",
    };
    expect(isProfileComplete(profile)).toBe(true);
    expect(isProfileComplete(profile)).toBe(true);
    expect(isProfileComplete(profile)).toBe(true);
  });

  it("Overflow/buffers: handles very long strings without breaking", () => {
    const long = "a".repeat(10000);
    expect(
      isProfileComplete({
        academicStanding: long,
        major: long,
        startingTerm: long,
      }),
    ).toBe(true);
  });
});

describe("hasCompletedOnboarding(userRecord)", () => {
  it("returns false when the user record is missing", () => {
    expect(hasCompletedOnboarding(null)).toBe(false);
    expect(hasCompletedOnboarding(undefined)).toBe(false);
  });

  it("returns false when either required onboarding field is blank", () => {
    expect(
      hasCompletedOnboarding({
        major_id: null,
        starting_term_id: "2",
      }),
    ).toBe(false);

    expect(
      hasCompletedOnboarding({
        major_id: "1",
        starting_term_id: "   ",
      }),
    ).toBe(false);
  });

  it("returns true when major and starting term are already saved", () => {
    expect(
      hasCompletedOnboarding({
        major_id: 3,
        starting_term_id: 7,
      }),
    ).toBe(true);
  });
});
