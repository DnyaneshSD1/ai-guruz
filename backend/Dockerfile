# One image definition for every backend service:
#   docker build --build-arg SERVICE=auth-service -t aiguruz/auth-service .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
COPY libs libs
COPY services services
ARG SERVICE
RUN --mount=type=cache,target=/root/.m2 mvn -q -B package -DskipTests -pl services/${SERVICE} -am

FROM eclipse-temurin:21-jre
ARG SERVICE
RUN useradd --system --create-home aiguruz
USER aiguruz
WORKDIR /app
COPY --from=build /src/services/${SERVICE}/target/${SERVICE}.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "app.jar"]
