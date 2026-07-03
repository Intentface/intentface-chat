---
"@intentface/chat": minor
---

Initial release: headless chat UI primitives (Composer, Message, Thread, Steps, Reasoning,
Chip, Attachments, Commands, StepQueue, AskUser, ArtifactCard, ArtifactsPanel), the
structural message contract and part guards, the chip wire format, and the message
derivation utilities — all unstyled, animation-free, and framework-agnostic (React peer
only; AI SDK `UIMessage` satisfies the types structurally). Styled components ship
separately via the shadcn-compatible registry.
