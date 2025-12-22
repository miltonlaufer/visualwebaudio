/**
 * Tests for Composite Editor Sub-components
 *
 * Tests for the extracted sub-components of the composite editor.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CompositeEditorAlerts from '~/components/CompositeEditor/CompositeEditorAlerts'
import CompositeEditorHeader from '~/components/CompositeEditor/CompositeEditorHeader'
import CompositeEditorDescription from '~/components/CompositeEditor/CompositeEditorDescription'

/******************* ALERTS COMPONENT ***********************/

describe('CompositeEditorAlerts', () => {
  it('should render nothing when both error and success are null', () => {
    const { container } = render(<CompositeEditorAlerts error={null} success={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render error message when error is provided', () => {
    render(<CompositeEditorAlerts error="Something went wrong" success={null} />)
    expect(screen.getByText('Something went wrong')).toBeDefined()
  })

  it('should render success message when success is provided', () => {
    render(<CompositeEditorAlerts error={null} success="Saved successfully!" />)
    expect(screen.getByText('Saved successfully!')).toBeDefined()
  })

  it('should render both error and success messages when both are provided', () => {
    render(<CompositeEditorAlerts error="Error message" success="Success message" />)
    expect(screen.getByText('Error message')).toBeDefined()
    expect(screen.getByText('Success message')).toBeDefined()
  })

  it('should apply error styling to error messages', () => {
    render(<CompositeEditorAlerts error="Error message" success={null} />)
    const errorElement = screen.getByText('Error message')
    expect(errorElement.className).toContain('text-red')
  })

  it('should apply success styling to success messages', () => {
    render(<CompositeEditorAlerts error={null} success="Success message" />)
    const successElement = screen.getByText('Success message')
    expect(successElement.className).toContain('text-green')
  })
})

/******************* HEADER COMPONENT ***********************/

describe('CompositeEditorHeader', () => {
  const defaultProps = {
    nodeName: 'Test Composite',
    onNameChange: vi.fn(),
    isCreatingNew: false,
    isPrebuilt: false,
    isDark: false,
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
  }

  it('should render with default props', () => {
    render(<CompositeEditorHeader {...defaultProps} />)
    expect(screen.getByTestId('composite-name-input')).toBeDefined()
  })

  it('should display the node name in input', () => {
    render(<CompositeEditorHeader {...defaultProps} />)
    const input = screen.getByTestId('composite-name-input') as HTMLInputElement
    expect(input.value).toBe('Test Composite')
  })

  it('should call onNameChange when name input changes', () => {
    const onNameChange = vi.fn()
    render(<CompositeEditorHeader {...defaultProps} onNameChange={onNameChange} />)
    const input = screen.getByTestId('composite-name-input')
    fireEvent.change(input, { target: { value: 'New Name' } })
    expect(onNameChange).toHaveBeenCalledWith('New Name')
  })

  it('should show "Edit Composite" title when not creating new', () => {
    render(<CompositeEditorHeader {...defaultProps} isCreatingNew={false} />)
    expect(screen.getByText('Edit Composite')).toBeDefined()
  })

  it('should show "Create Composite" title when creating new', () => {
    render(<CompositeEditorHeader {...defaultProps} isCreatingNew={true} />)
    expect(screen.getByText('Create Composite')).toBeDefined()
  })

  it('should show prebuilt badge when isPrebuilt is true', () => {
    render(<CompositeEditorHeader {...defaultProps} isPrebuilt={true} />)
    expect(screen.getByText('Prebuilt (Read-only)')).toBeDefined()
  })

  it('should show new badge when isCreatingNew is true', () => {
    render(<CompositeEditorHeader {...defaultProps} isCreatingNew={true} />)
    expect(screen.getByText('New')).toBeDefined()
  })

  it('should disable name input when isPrebuilt is true', () => {
    render(<CompositeEditorHeader {...defaultProps} isPrebuilt={true} />)
    const input = screen.getByTestId('composite-name-input') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('should call onSave when save button is clicked', () => {
    const onSave = vi.fn()
    render(<CompositeEditorHeader {...defaultProps} onSave={onSave} />)
    const saveButton = screen.getByTestId('composite-save-button')
    fireEvent.click(saveButton)
    expect(onSave).toHaveBeenCalled()
  })

  it('should call onSaveAs when save-as button is clicked', () => {
    const onSaveAs = vi.fn()
    render(<CompositeEditorHeader {...defaultProps} onSaveAs={onSaveAs} />)
    const saveAsButton = screen.getByTestId('composite-save-as-button')
    fireEvent.click(saveAsButton)
    expect(onSaveAs).toHaveBeenCalled()
  })

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(<CompositeEditorHeader {...defaultProps} onDelete={onDelete} />)
    const deleteButton = screen.getByTestId('composite-delete-button')
    fireEvent.click(deleteButton)
    expect(onDelete).toHaveBeenCalled()
  })

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<CompositeEditorHeader {...defaultProps} onClose={onClose} />)
    const closeButton = screen.getByTestId('composite-close-button')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('should call onExport when export button is clicked', () => {
    const onExport = vi.fn()
    render(<CompositeEditorHeader {...defaultProps} onExport={onExport} />)
    const exportButton = screen.getByTestId('composite-export-button')
    fireEvent.click(exportButton)
    expect(onExport).toHaveBeenCalled()
  })

  it('should not show export/import buttons when isPrebuilt is true', () => {
    render(<CompositeEditorHeader {...defaultProps} isPrebuilt={true} />)
    expect(screen.queryByTestId('composite-export-button')).toBeNull()
    expect(screen.queryByTestId('composite-import-button')).toBeNull()
  })

  it('should not show save button when isPrebuilt is true', () => {
    render(<CompositeEditorHeader {...defaultProps} isPrebuilt={true} />)
    expect(screen.queryByTestId('composite-save-button')).toBeNull()
  })

  it('should not show delete button when isPrebuilt is true', () => {
    render(<CompositeEditorHeader {...defaultProps} isPrebuilt={true} />)
    expect(screen.queryByTestId('composite-delete-button')).toBeNull()
  })

  it('should not show save button when creating new', () => {
    render(<CompositeEditorHeader {...defaultProps} isCreatingNew={true} />)
    expect(screen.queryByTestId('composite-save-button')).toBeNull()
  })

  it('should show "Save" text on save-as button when creating new', () => {
    render(<CompositeEditorHeader {...defaultProps} isCreatingNew={true} />)
    const saveAsButton = screen.getByTestId('composite-save-as-button')
    expect(saveAsButton.textContent).toBe('Save')
  })

  it('should show "Save As" text on save-as button when editing existing', () => {
    render(<CompositeEditorHeader {...defaultProps} isCreatingNew={false} />)
    const saveAsButton = screen.getByTestId('composite-save-as-button')
    expect(saveAsButton.textContent).toBe('Save As')
  })
})

/******************* DESCRIPTION COMPONENT ***********************/

describe('CompositeEditorDescription', () => {
  const defaultProps = {
    description: 'Test description',
    onDescriptionChange: vi.fn(),
    isReadOnly: false,
    isDark: false,
  }

  it('should render with default props', () => {
    render(<CompositeEditorDescription {...defaultProps} />)
    expect(screen.getByTestId('composite-description')).toBeDefined()
  })

  it('should display the description in textarea', () => {
    render(<CompositeEditorDescription {...defaultProps} />)
    const textarea = screen.getByTestId('composite-description') as HTMLTextAreaElement
    expect(textarea.value).toBe('Test description')
  })

  it('should call onDescriptionChange when textarea changes', () => {
    const onDescriptionChange = vi.fn()
    render(
      <CompositeEditorDescription {...defaultProps} onDescriptionChange={onDescriptionChange} />
    )
    const textarea = screen.getByTestId('composite-description')
    fireEvent.change(textarea, { target: { value: 'New description' } })
    expect(onDescriptionChange).toHaveBeenCalledWith('New description')
  })

  it('should disable textarea when isReadOnly is true', () => {
    render(<CompositeEditorDescription {...defaultProps} isReadOnly={true} />)
    const textarea = screen.getByTestId('composite-description') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })

  it('should show label', () => {
    render(<CompositeEditorDescription {...defaultProps} />)
    expect(screen.getByText('Description')).toBeDefined()
  })
})
