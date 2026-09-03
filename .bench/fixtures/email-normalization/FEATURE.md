# Feature: normalize email addresses

Update `createUser` in `src/users.ts` to normalize the supplied email address.

- Remove whitespace at both ends.
- Convert the address to lowercase.
- Reject an empty result with an error.
- Add focused tests in `src/users.test.ts`.
