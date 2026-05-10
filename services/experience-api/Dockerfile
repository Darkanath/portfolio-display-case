# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ExperienceApi.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish ExperienceApi.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# The aspnet:10.0 image ships with a non-root 'app' user (UID/GID 1001) already.
# We just use it; no need to create it.
COPY --from=build --chown=app:app /app/publish ./

USER app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ExperienceApi.dll"]