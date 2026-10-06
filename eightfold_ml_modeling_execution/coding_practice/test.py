from openai import OpenAI

client = OpenAI(api_key="your-key")

def call_llm(system_prompt, user_message):
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )
    return response.choices[0].message.content

def candidate_retrieval_agent(job_description):
    system = f"""You are a candidate retrieval agent. 
    Given a job description, return the top 10 
    matching candidate profiles in JSON format."""
    
    return call_llm(system, job_description)

def summarizer_agent(candidate_profiles):
    system = f"""You are a profile summarizer. 
    Given candidate profiles, return a concise 
    2-line summary for each candidate."""
    
    return call_llm(system, candidate_profiles)

def email_drafting_agent(candidate_summaries, job_title):
    system = f"""You are an email drafting agent. 
    Given the top 3 candidate summaries for a {job_title} role,
    draft a personalised outreach email for each candidate."""
    
    return call_llm(system, candidate_summaries)