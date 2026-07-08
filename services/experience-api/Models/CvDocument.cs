namespace ExperienceApi.Models;

public record CvDocument(
    Profile Profile,
    ExperienceEntry[] Experience,
    Skills Skills,
    Education[] Education,
    Language[] Languages,
    MilitaryServiceEntry[] MilitaryService
);
