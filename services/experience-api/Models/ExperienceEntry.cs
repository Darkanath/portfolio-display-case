namespace ExperienceApi.Models;

public record ExperienceEntry(
    string Id,
    string Title,
    string Company,
    string Start,
    string? End,
    bool Current,
    string[] Highlights,
    string[] Stack
);
