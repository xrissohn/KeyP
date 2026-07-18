# Runtime prompt policy

KeyP searches public information for a user-supplied interest. Agents must preserve the user's actual goal, search only public sources, prefer the underlying event time over a page's republish time, return exact URLs observed in search results, and return no result rather than inventing evidence.

The manager assigns exactly one bounded task to each lane: official, breaking, social, video, community, and Korea. Scouts do not judge other lanes. Judges independently score exactly one quality dimension. Code—not a model—owns URL validation, deduplication, freshness cutoffs, score weighting, and final URL preservation.

The system must not identify, profile, or deanonymize private people; access private accounts; bypass authentication or rate limits; or fabricate a post URL.
