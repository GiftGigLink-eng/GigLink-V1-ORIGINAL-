export interface SkillCatalogueItem {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export const APPROVED_SKILL_CATEGORIES = [
  'Frontend Development',
  'Backend Development',
  'Mobile Development',
  'Cloud & DevOps',
  'Database & Storage',
  'AI, ML & Data Science',
  'Data Engineering & Analytics',
  'UI/UX & Product Design',
  'Product Management & Agile',
  'Cybersecurity & IAM',
  'QA & Test Automation',
  'Blockchain & Web3',
] as const;

export const APPROVED_SKILLS_CATALOGUE: SkillCatalogueItem[] = [
  // Frontend Development
  { id: 'skill-react', name: 'React', category: 'Frontend Development' },
  { id: 'skill-typescript', name: 'TypeScript', category: 'Frontend Development' },
  { id: 'skill-javascript', name: 'JavaScript (ES6+)', category: 'Frontend Development' },
  { id: 'skill-nextjs', name: 'Next.js', category: 'Frontend Development' },
  { id: 'skill-vue', name: 'Vue.js', category: 'Frontend Development' },
  { id: 'skill-angular', name: 'Angular', category: 'Frontend Development' },
  { id: 'skill-svelte', name: 'Svelte / SvelteKit', category: 'Frontend Development' },
  { id: 'skill-tailwind', name: 'Tailwind CSS', category: 'Frontend Development' },
  { id: 'skill-html5-css3', name: 'HTML5 & CSS3', category: 'Frontend Development' },
  { id: 'skill-redux', name: 'Redux / Redux Toolkit', category: 'Frontend Development' },
  { id: 'skill-zustand', name: 'Zustand', category: 'Frontend Development' },
  { id: 'skill-tanstack-query', name: 'TanStack Query (React Query)', category: 'Frontend Development' },
  { id: 'skill-webassembly', name: 'WebAssembly (WASM)', category: 'Frontend Development' },
  { id: 'skill-remix', name: 'Remix', category: 'Frontend Development' },

  // Backend Development
  { id: 'skill-nodejs', name: 'Node.js', category: 'Backend Development' },
  { id: 'skill-express', name: 'Express.js', category: 'Backend Development' },
  { id: 'skill-nestjs', name: 'NestJS', category: 'Backend Development' },
  { id: 'skill-python', name: 'Python', category: 'Backend Development' },
  { id: 'skill-django', name: 'Django', category: 'Backend Development' },
  { id: 'skill-fastapi', name: 'FastAPI', category: 'Backend Development' },
  { id: 'skill-golang', name: 'Go (Golang)', category: 'Backend Development' },
  { id: 'skill-rust', name: 'Rust', category: 'Backend Development' },
  { id: 'skill-java', name: 'Java', category: 'Backend Development' },
  { id: 'skill-springboot', name: 'Spring Boot', category: 'Backend Development' },
  { id: 'skill-csharp', name: 'C# / .NET Core', category: 'Backend Development' },
  { id: 'skill-php', name: 'PHP', category: 'Backend Development' },
  { id: 'skill-laravel', name: 'Laravel', category: 'Backend Development' },
  { id: 'skill-rubyonrails', name: 'Ruby on Rails', category: 'Backend Development' },
  { id: 'skill-graphql', name: 'GraphQL', category: 'Backend Development' },
  { id: 'skill-rest-api', name: 'RESTful API Architecture', category: 'Backend Development' },
  { id: 'skill-grpc', name: 'gRPC & Protocol Buffers', category: 'Backend Development' },
  { id: 'skill-microservices', name: 'Microservices Architecture', category: 'Backend Development' },

  // Mobile Development
  { id: 'skill-react-native', name: 'React Native', category: 'Mobile Development' },
  { id: 'skill-flutter', name: 'Flutter', category: 'Mobile Development' },
  { id: 'skill-ios-swift', name: 'iOS (Swift & SwiftUI)', category: 'Mobile Development' },
  { id: 'skill-android-kotlin', name: 'Android (Kotlin & Jetpack Compose)', category: 'Mobile Development' },
  { id: 'skill-expo', name: 'Expo', category: 'Mobile Development' },
  { id: 'skill-dart', name: 'Dart', category: 'Mobile Development' },

  // Cloud & DevOps
  { id: 'skill-aws', name: 'Amazon Web Services (AWS)', category: 'Cloud & DevOps' },
  { id: 'skill-gcp', name: 'Google Cloud Platform (GCP)', category: 'Cloud & DevOps' },
  { id: 'skill-azure', name: 'Microsoft Azure', category: 'Cloud & DevOps' },
  { id: 'skill-docker', name: 'Docker & Containerization', category: 'Cloud & DevOps' },
  { id: 'skill-kubernetes', name: 'Kubernetes (K8s)', category: 'Cloud & DevOps' },
  { id: 'skill-terraform', name: 'Terraform & IaC', category: 'Cloud & DevOps' },
  { id: 'skill-cicd', name: 'CI/CD Pipelines (GitHub Actions / GitLab)', category: 'Cloud & DevOps' },
  { id: 'skill-linux', name: 'Linux System Administration', category: 'Cloud & DevOps' },
  { id: 'skill-nginx', name: 'Nginx & Reverse Proxies', category: 'Cloud & DevOps' },
  { id: 'skill-prometheus', name: 'Prometheus & Grafana Observability', category: 'Cloud & DevOps' },
  { id: 'skill-serverless', name: 'Serverless Architecture (Lambda / Cloud Run)', category: 'Cloud & DevOps' },

  // Database & Storage
  { id: 'skill-postgresql', name: 'PostgreSQL', category: 'Database & Storage' },
  { id: 'skill-mongodb', name: 'MongoDB', category: 'Database & Storage' },
  { id: 'skill-mysql', name: 'MySQL', category: 'Database & Storage' },
  { id: 'skill-redis', name: 'Redis Caching & Pub/Sub', category: 'Database & Storage' },
  { id: 'skill-firestore', name: 'Firebase Firestore & Realtime DB', category: 'Database & Storage' },
  { id: 'skill-supabase', name: 'Supabase', category: 'Database & Storage' },
  { id: 'skill-prisma', name: 'Prisma ORM', category: 'Database & Storage' },
  { id: 'skill-dynamodb', name: 'Amazon DynamoDB', category: 'Database & Storage' },
  { id: 'skill-elasticsearch', name: 'Elasticsearch', category: 'Database & Storage' },
  { id: 'skill-sqlite', name: 'SQLite', category: 'Database & Storage' },
  { id: 'skill-vector-db', name: 'Vector Databases (Pinecone / Chroma / Milvus)', category: 'Database & Storage' },

  // AI, ML & Data Science
  { id: 'skill-llm-engineering', name: 'LLM Prompt Engineering & Agents', category: 'AI, ML & Data Science' },
  { id: 'skill-gemini-api', name: 'Gemini API & Multimodal AI', category: 'AI, ML & Data Science' },
  { id: 'skill-langchain', name: 'LangChain & LlamaIndex', category: 'AI, ML & Data Science' },
  { id: 'skill-rag', name: 'Retrieval-Augmented Generation (RAG)', category: 'AI, ML & Data Science' },
  { id: 'skill-pytorch', name: 'PyTorch', category: 'AI, ML & Data Science' },
  { id: 'skill-tensorflow', name: 'TensorFlow', category: 'AI, ML & Data Science' },
  { id: 'skill-machine-learning', name: 'Machine Learning (Scikit-Learn)', category: 'AI, ML & Data Science' },
  { id: 'skill-deep-learning', name: 'Deep Learning & Neural Networks', category: 'AI, ML & Data Science' },
  { id: 'skill-nlp', name: 'Natural Language Processing (NLP)', category: 'AI, ML & Data Science' },
  { id: 'skill-computer-vision', name: 'Computer Vision (OpenCV)', category: 'AI, ML & Data Science' },
  { id: 'skill-mlops', name: 'MLOps & Model Deployment', category: 'AI, ML & Data Science' },
  { id: 'skill-huggingface', name: 'Hugging Face Transformers', category: 'AI, ML & Data Science' },

  // Data Engineering & Analytics
  { id: 'skill-sql', name: 'Advanced SQL', category: 'Data Engineering & Analytics' },
  { id: 'skill-apache-spark', name: 'Apache Spark', category: 'Data Engineering & Analytics' },
  { id: 'skill-apache-kafka', name: 'Apache Kafka & Event Streaming', category: 'Data Engineering & Analytics' },
  { id: 'skill-snowflake', name: 'Snowflake Data Warehouse', category: 'Data Engineering & Analytics' },
  { id: 'skill-bigquery', name: 'Google BigQuery', category: 'Data Engineering & Analytics' },
  { id: 'skill-dbt', name: 'dbt (data build tool)', category: 'Data Engineering & Analytics' },
  { id: 'skill-airflow', name: 'Apache Airflow Orchestration', category: 'Data Engineering & Analytics' },
  { id: 'skill-powerbi', name: 'Power BI', category: 'Data Engineering & Analytics' },
  { id: 'skill-tableau', name: 'Tableau', category: 'Data Engineering & Analytics' },
  { id: 'skill-pandas-numpy', name: 'Pandas & NumPy Data Analysis', category: 'Data Engineering & Analytics' },

  // UI/UX & Product Design
  { id: 'skill-figma', name: 'Figma', category: 'UI/UX & Product Design' },
  { id: 'skill-ui-design', name: 'User Interface (UI) Design', category: 'UI/UX & Product Design' },
  { id: 'skill-ux-research', name: 'User Experience (UX) Research', category: 'UI/UX & Product Design' },
  { id: 'skill-design-systems', name: 'Design Systems & Component Libraries', category: 'UI/UX & Product Design' },
  { id: 'skill-prototyping', name: 'Interactive Wireframing & Prototyping', category: 'UI/UX & Product Design' },
  { id: 'skill-wcag-accessibility', name: 'Accessibility (WCAG 2.1 AA)', category: 'UI/UX & Product Design' },
  { id: 'skill-information-architecture', name: 'Information Architecture', category: 'UI/UX & Product Design' },

  // Product Management & Agile
  { id: 'skill-product-management', name: 'Product Strategy & Roadmapping', category: 'Product Management & Agile' },
  { id: 'skill-scrum-agile', name: 'Agile & Scrum Methodologies', category: 'Product Management & Agile' },
  { id: 'skill-jira-confluence', name: 'Jira & Confluence Management', category: 'Product Management & Agile' },
  { id: 'skill-product-analytics', name: 'Product Analytics (Mixpanel / Amplitude)', category: 'Product Management & Agile' },
  { id: 'skill-user-stories', name: 'Technical User Story Mapping', category: 'Product Management & Agile' },

  // Cybersecurity & IAM
  { id: 'skill-app-sec', name: 'Application Security (AppSec / OWASP Top 10)', category: 'Cybersecurity & IAM' },
  { id: 'skill-penetration-testing', name: 'Penetration Testing & Ethical Hacking', category: 'Cybersecurity & IAM' },
  { id: 'skill-iam', name: 'Identity & Access Management (IAM / OAuth2 / OIDC)', category: 'Cybersecurity & IAM' },
  { id: 'skill-cryptography', name: 'Applied Cryptography & PKI', category: 'Cybersecurity & IAM' },
  { id: 'skill-soc2', name: 'SOC 2 & ISO 27001 Compliance', category: 'Cybersecurity & IAM' },

  // QA & Test Automation
  { id: 'skill-jest-vitest', name: 'Jest & Vitest Unit Testing', category: 'QA & Test Automation' },
  { id: 'skill-cypress', name: 'Cypress E2E Testing', category: 'QA & Test Automation' },
  { id: 'skill-playwright', name: 'Playwright Browser Automation', category: 'QA & Test Automation' },
  { id: 'skill-selenium', name: 'Selenium WebDriver', category: 'QA & Test Automation' },
  { id: 'skill-api-testing-postman', name: 'API Automated Testing (Postman / Newman)', category: 'QA & Test Automation' },

  // Blockchain & Web3
  { id: 'skill-solidity', name: 'Solidity Smart Contracts', category: 'Blockchain & Web3' },
  { id: 'skill-smart-contract-audit', name: 'Smart Contract Auditing & Security', category: 'Blockchain & Web3' },
  { id: 'skill-ethers-web3', name: 'Ethers.js / Viem / Wagmi', category: 'Blockchain & Web3' },
  { id: 'skill-rust-solana', name: 'Rust for Solana / Anchor', category: 'Blockchain & Web3' },
];

/**
 * Search approved skills matching query (case-insensitive) excluding already selected skills
 */
export function searchApprovedSkills(
  query: string,
  excludedSkillNames: string[] = [],
  maxResults = 8
): SkillCatalogueItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const excludedSet = new Set(excludedSkillNames.map((n) => n.toLowerCase()));

  return APPROVED_SKILLS_CATALOGUE.filter((item) => {
    if (excludedSet.has(item.name.toLowerCase())) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const nameMatch = item.name.toLowerCase().includes(normalizedQuery);
    const categoryMatch = item.category.toLowerCase().includes(normalizedQuery);
    return nameMatch || categoryMatch;
  }).slice(0, maxResults);
}

/**
 * Get skill item by exact name or ID (case-insensitive)
 */
export function getSkillByName(nameOrId: string): SkillCatalogueItem | undefined {
  const target = nameOrId.trim().toLowerCase();
  return APPROVED_SKILLS_CATALOGUE.find(
    (item) => item.name.toLowerCase() === target || item.id.toLowerCase() === target
  );
}

/**
 * Validates whether a skill name exists in the approved catalogue
 */
export function isSkillInCatalogue(name: string): boolean {
  return getSkillByName(name) !== undefined;
}
