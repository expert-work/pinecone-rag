export interface Job {
    title: string;
    description: string;
    industry: string;
    job_location_address_locality: string;
    job_location_address_region: string;
    base_salary_value: number;
    base_salary_term: string;
    employment_type: string;
    experience_requirements: string;
    education_requirements: string;
}

// npx prisma generate
// npx prisma db push