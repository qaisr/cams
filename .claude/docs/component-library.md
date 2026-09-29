# Reusable Component Library

## Purpose

Canonical UI composition patterns for this repository using the project's component library and token-driven styling.
These patterns should be reused before inventing new structures.

## Source References

- `@.claude/standards/ui-design-standards.md`

## Pattern: Page Header With Action

```tsx
<SectionHeader
  heading="Margin Dashboard"
  subHeading="Review exposures and resolve breaks"
  size="large"
  trailingContent={
    <Button variant="primary" onClick={onCreateCase}>
      Create Case
    </Button>
  }
/>
```

When to use:

- Top-level page entry point with one clear primary action.

## Pattern: Card Surface Layout

```tsx
<Box surface="container" padding="tile" radius="medium">
  <Flex direction="column" gap="container-medium">
    <Heading element="h3" variant="secondary">
      Position Summary
    </Heading>
    <Text variant="body" color="secondary">
      <p>Current valuation and exposure snapshot.</p>
    </Text>
  </Flex>
</Box>
```

When to use:

- Grouping related information in dashboard modules or detail sections.

## Pattern: Form Section With Actions

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
  <Flex direction="column" gap="container-large">
    <TextField label="Agreement Name" {...register('name')} />
    <Select label="Status" {...register('status')} options={statusOptions} />

    <Flex direction="row" gap="container-small" justify="flex-end">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        variant="primary"
        loading={{ isLoading: isSubmitting, text: 'Saving...' }}
        type="submit"
      >
        Save
      </Button>
    </Flex>
  </Flex>
</form>
```

When to use:

- Create/edit flows with clear primary submit and secondary cancel.

## Pattern: Data Table Container

```tsx
<Box surface="default" padding="none">
  <Flex direction="column" gap="container-small">
    <SectionHeader heading="Eligible Trades" size="medium" />
    <DataTable columns={columns} rows={rows} />
    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
  </Flex>
</Box>
```

When to use:

- Resource lists with large datasets and pagination.

## Pattern: Loading State

```tsx
{isLoading ? (
  <Flex direction="column" gap="container-small" aria-busy="true" role="status">
    <SkeletonLoader width="full" height="large" labelText="Loading section header" />
    <SkeletonLoader width="full" height="medium" labelText="Loading rows" />
    <SkeletonLoader width="full" height="medium" labelText="Loading rows" />
  </Flex>
) : (
  <Content />
)}
```

## Pattern: Error State

```tsx
{error ? (
  <MessageBanner
    variant="critical"
    heading="Unable to load data"
    description="Please retry. If the issue persists, contact support with the correlation ID."
    id="dashboard-load-error"
    action={<Button variant="tertiary" onClick={retry}>Try again</Button>}
    isOpen
  />
) : null}
```

## Pattern: Empty State

```tsx
<Box surface="tertiary" padding="tile" radius="medium">
  <Flex direction="column" align="center" gap="container-small">
    <Icons.EmptyState160 aria-hidden="true" />
    <Heading element="h3" variant="secondary">
      No records yet
    </Heading>
    <Text variant="body" color="secondary">
      <p>Create your first record to get started.</p>
    </Text>
    <Button variant="primary" onClick={onCreate}>Create record</Button>
  </Flex>
</Box>
```

## Pattern: Slide-In Context Panel

```tsx
<Drawer
  isOpen={isPanelOpen}
  position="right"
  title="Trade Details"
  hideTitle={false}
  onClose={closePanel}
>
  <TradeDetails tradeId={selectedTradeId} />
</Drawer>
```

When to use:

- Secondary workflows that should not force navigation.

## Accessibility Defaults

- All actionable elements have accessible names.
- Focus-visible states must be visible.
- Loading regions use role="status" when relevant.
- Error messaging uses an announced component (for example MessageBanner).
- Forms use explicit labels and actionable error copy.

## Review Checklist For New Patterns

- [ ] Reuses project design system components first
- [ ] Uses tokens, not hardcoded visual values
- [ ] Includes loading, error, and empty patterns where applicable
- [ ] Tested for keyboard navigation
- [ ] Tested at 375px, 768px, and 1440px
- [ ] Captured in this document if pattern is reusable
