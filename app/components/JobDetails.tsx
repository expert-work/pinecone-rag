import React from 'react';
import { Job } from '@/types/job';

interface JobDetailsProps {
  job: Job;
}

const JobDetails: React.FC<JobDetailsProps> = ({ job }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-4">
      <h2 className="text-2xl font-bold mb-2">{job.title}</h2>
      <p className="text-gray-600 mb-4">{job.description}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p><strong>Industry:</strong> {job.industry}</p>
          <p><strong>Location:</strong> {job.job_location_address_locality}, {job.job_location_address_region}</p>
          <p><strong>Salary:</strong> ${job.base_salary_value} {job.base_salary_term && `per ${job.base_salary_term.toLowerCase()}`}</p>
        </div>
        <div>
          <p><strong>Employment Type:</strong> {job.employment_type}</p>
          <p><strong>Experience Required:</strong> {job.experience_requirements}</p>
          <p><strong>Education:</strong> {job.education_requirements}</p>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;