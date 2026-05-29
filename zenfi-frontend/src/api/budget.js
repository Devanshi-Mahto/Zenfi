import axiosInstance from './axiosInstance';
import { getMe, updateMe } from './auth';

const DEFAULT_BUDGET = 30000;

/** Load budget — prefers /me/, falls back to /budget/ */
export const getBudget = async () => {
  try {
    const me = await getMe();
    if (me.data?.monthly_budget != null) {
      return { data: { monthly_budget: me.data.monthly_budget } };
    }
  } catch {
    /* try dedicated endpoint next */
  }
  return axiosInstance.get('/budget/');
};

/** Save budget — prefers /budget/, falls back to PATCH /me/ */
export const updateBudget = async (monthly_budget) => {
  try {
    return await axiosInstance.patch('/budget/', { monthly_budget });
  } catch (err) {
    if (err.response?.status === 404) {
      const me = await updateMe({ monthly_budget });
      return { data: { monthly_budget: me.data.monthly_budget ?? monthly_budget } };
    }
    throw err;
  }
};

export { DEFAULT_BUDGET };
