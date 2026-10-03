package com.aiguruz.document;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;

/** Where uploaded files live: the local filesystem for development, S3 in production. */
public interface Storage {

    void put(String key, InputStream content, long size, String contentType);

    InputStream get(String key);

    void delete(String key);

    final class Local implements Storage {
        private final Path root;

        public Local(String dir) {
            this.root = Path.of(dir).toAbsolutePath().normalize();
        }

        @Override
        public void put(String key, InputStream content, long size, String contentType) {
            try {
                Path target = resolve(key);
                Files.createDirectories(target.getParent());
                Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        @Override
        public InputStream get(String key) {
            try {
                return Files.newInputStream(resolve(key));
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        @Override
        public void delete(String key) {
            try {
                Files.deleteIfExists(resolve(key));
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        private Path resolve(String key) {
            Path path = root.resolve(key).normalize();
            if (!path.startsWith(root)) {
                throw new IllegalArgumentException("Invalid storage key");
            }
            return path;
        }
    }

    final class S3 implements Storage {
        private final S3Client s3 = S3Client.create();
        private final String bucket;

        public S3(String bucket) {
            this.bucket = bucket;
        }

        @Override
        public void put(String key, InputStream content, long size, String contentType) {
            s3.putObject(b -> b.bucket(bucket).key(key).contentType(contentType),
                    RequestBody.fromInputStream(content, size));
        }

        @Override
        public InputStream get(String key) {
            return s3.getObject(b -> b.bucket(bucket).key(key));
        }

        @Override
        public void delete(String key) {
            s3.deleteObject(b -> b.bucket(bucket).key(key));
        }
    }
}
