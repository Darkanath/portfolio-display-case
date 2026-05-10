# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ExperienceApi.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish ExperienceApi.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Run as non-root
RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app app

COPY --from=build --chown=app:app /app/publish ./

USER app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ExperienceApi.dll"]
