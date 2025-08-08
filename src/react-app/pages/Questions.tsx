import { useState, useEffect } from 'react';
import API_ENDPOINTS from '../config/api';

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  tags: string;
}
import Layout from '@/react-app/components/Layout';
import { Search, BookOpen, ChevronDown, ChevronUp, Filter, Hash } from 'lucide-react';

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  tags: string;
}

export default function Questions() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [filteredFaqs, setFilteredFaqs] = useState<FAQ[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFAQs();
  }, []);

  useEffect(() => {
    filterFAQs();
  }, [faqs, searchTerm, selectedCategory]);

  const fetchFAQs = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.FAQS);
      const data = await response.json();
      setFaqs(data.faqs || []);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterFAQs = () => {
    let filtered = faqs;

    if (searchTerm) {
      filtered = filtered.filter(faq =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.tags.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    setFilteredFaqs(filtered);
  };

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const categories = Array.from(new Set(faqs.map(faq => faq.category))).filter(Boolean);

  const handleQuestionClick = (question: string) => {
    setSearchTerm(question);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
              <p className="text-lg text-purple-200">Browse through commonly asked questions and find instant answers</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-white/60" />
                <input
                  type="text"
                  placeholder="Search questions, answers, or topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-3 w-5 h-5 text-white/60" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400 appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category} className="bg-gray-800">
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-4 flex items-center space-x-6 text-sm text-purple-200">
              <span>{filteredFaqs.length} questions found</span>
              <span>•</span>
              <span>{categories.length} categories</span>
            </div>
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No questions found</h3>
              <p className="text-purple-200">Try adjusting your search terms or category filter</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => (
              <div key={faq.id} className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                <button
                  onClick={() => toggleExpanded(faq.id)}
                  className="w-full p-6 text-left hover:bg-white/5 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Hash className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-300 font-medium">{faq.category}</span>
                    </div>
                    <h3 className="text-lg font-medium text-white leading-relaxed">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="ml-4">
                    {expandedItems.has(faq.id) ? (
                      <ChevronUp className="w-5 h-5 text-white/60" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/60" />
                    )}
                  </div>
                </button>

                {expandedItems.has(faq.id) && (
                  <div className="px-6 pb-6">
                    <div className="border-t border-white/20 pt-4">
                      <div className="prose prose-invert max-w-none">
                        <p className="text-purple-100 leading-relaxed whitespace-pre-wrap">
                          {faq.answer}
                        </p>
                      </div>
                      {faq.tags && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {faq.tags.split(',').map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-md"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Popular Questions */}
        {searchTerm === '' && (
          <div className="mt-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Popular Questions</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {filteredFaqs.slice(0, 8).map((faq) => (
                <button
                  key={faq.id}
                  onClick={() => handleQuestionClick(faq.question)}
                  className="text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="text-sm text-purple-300 mb-1">{faq.category}</div>
                  <div className="text-white font-medium text-sm leading-relaxed">
                    {faq.question}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
