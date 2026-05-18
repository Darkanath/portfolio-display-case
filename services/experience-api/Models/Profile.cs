namespace ExperienceApi.Models;

public record Profile(
    string Name,
    string Tagline,
    string Summary,
    string? Location,
    int YearsOfExperience
);
