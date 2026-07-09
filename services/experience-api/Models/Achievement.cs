namespace ExperienceApi.Models;

public record Achievement(
    string Text,
    string[] Tags,
    string? Metric
);
