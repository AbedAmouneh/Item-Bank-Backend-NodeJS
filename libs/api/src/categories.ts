export interface Category {
  id: number;
  name: string;
  children: Category[];
}

export interface CreateCategoryData {
  name: string;
  parent_id?: number;
}

export interface UpdateCategoryData {
  name: string;
}

export interface AssignQuestionsData {
  question_ids: number[];
}

export type GetCategories = () => Promise<Category[]>;
export type CreateCategory = (data: CreateCategoryData) => Promise<Category>;
export type UpdateCategory = (id: number, data: UpdateCategoryData) => Promise<Category>;
export type DeleteCategory = (id: number) => Promise<void>;
export type AssignQuestionsToCategory = (
  categoryId: number,
  data: AssignQuestionsData
) => Promise<void>;
export type RemoveQuestionFromCategory = (
  categoryId: number,
  questionId: number
) => Promise<void>;
