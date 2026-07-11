# Start with the tiny 5MB Alpine Linux OS
FROM alpine:latest
# Install only the C compiler, C++ compiler, and standard math/C libraries
RUN apk add --no-cache gcc g++ musl-dev