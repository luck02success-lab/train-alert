ALTER TABLE users
ADD COLUMN firebase_uid text;

CREATE UNIQUE INDEX users_firebase_uid_idx
ON users(firebase_uid)
WHERE firebase_uid IS NOT NULL;