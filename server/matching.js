import { broaderSkills } from "./skills.js";

function normalized(value) {
  return value.trim().toLowerCase();
}

export function scoreJob(job, candidate) {
  const candidateSkills = new Set(candidate.skills.map(normalized));
  const skillBreakdown = job.skills.map((skill) => {
    if (candidateSkills.has(normalized(skill))) {
      return { skill, matched: true, matchType: "exact", contribution: 1, reason: "Exact skill" };
    }

    // Only the listed specific-to-broader direction counts. Taxonomy order
    // chooses stable evidence when several candidate skills support a requirement.
    const relatedSkill = Object.keys(broaderSkills).find((specific) =>
      candidateSkills.has(normalized(specific)) &&
      broaderSkills[specific].some((broader) => normalized(broader) === normalized(skill)));
    if (relatedSkill) {
      return {
        skill,
        matched: false,
        matchType: "related",
        contribution: 0.5,
        candidateSkill: relatedSkill,
        reason: `Related skill: ${relatedSkill} → ${skill} (50% credit)`,
      };
    }

    return { skill, matched: false, matchType: "missing", contribution: 0, reason: "Not found" };
  });
  const matchedCount = skillBreakdown.filter((item) => item.matched).length;
  const totalContribution = skillBreakdown.reduce((total, item) => total + item.contribution, 0);
  const skillScore = job.skills.length ? totalContribution / job.skills.length : 0;
  const locationFits = job.location === candidate.location || job.workMode === "Remote";
  const score = Math.round(skillScore * 80 + (locationFits ? 20 : 0));

  return {
    score,
    matchedCount,
    requiredCount: job.skills.length,
    locationFits,
    skillBreakdown,
  };
}

export function rankJobs(jobs, candidate) {
  return jobs
    .map((job) => ({ ...job, match: scoreJob(job, candidate) }))
    .sort((a, b) => b.match.score - a.match.score || a.title.localeCompare(b.title));
}
